using System.Collections.Concurrent;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace NKRN.API.Services;

/// <summary>
/// Short-lived, single-use email challenges. The portal runs on one API node;
/// a pending code expires when that process restarts (fail closed).
/// No credentials, verification codes or code hashes are written to SQL.
/// </summary>
public sealed class EmailLoginChallengeStore
{
    private sealed class Challenge
    {
        public required string Email { get; init; }
        public required byte[] CodeHash { get; init; }
        public required DateTimeOffset Expires { get; init; }
        public int FailedAttempts { get; set; }
        public object Sync { get; } = new();
    }

    private sealed class IssueWindow
    {
        public DateTimeOffset Started { get; set; }
        public int Issued { get; set; }
        public object Sync { get; } = new();
    }

    private readonly ConcurrentDictionary<Guid, Challenge> _pending = new();
    private readonly ConcurrentDictionary<string, IssueWindow> _rateLimits =
        new(StringComparer.OrdinalIgnoreCase);

    public bool TryCreate(string email, out Guid challengeId, out string code)
    {
        challengeId = Guid.Empty;
        code = string.Empty;
        var now = DateTimeOffset.UtcNow;
        var normalised = email.Trim().ToLowerInvariant();
        var rate = _rateLimits.GetOrAdd(normalised, _ => new IssueWindow());

        lock (rate.Sync)
        {
            if (now - rate.Started >= TimeSpan.FromMinutes(10))
            {
                rate.Started = now;
                rate.Issued = 0;
            }
            if (rate.Issued >= 3) return false;
            rate.Issued++;
        }

        // Prune expired challenges before adding any more.
        foreach (var (key, pending) in _pending)
            if (pending.Expires <= now) _pending.TryRemove(key, out _);

        code = RandomNumberGenerator.GetInt32(0, 1_000_000)
            .ToString("D6", CultureInfo.InvariantCulture);
        challengeId = Guid.NewGuid();
        _pending[challengeId] = new Challenge
        {
            Email = normalised,
            CodeHash = SHA256.HashData(Encoding.UTF8.GetBytes(code)),
            Expires = now.AddMinutes(5)
        };
        return true;
    }

    public void Revoke(Guid challengeId) => _pending.TryRemove(challengeId, out _);

    public bool TryVerify(Guid challengeId, string email, string code)
    {
        if (!_pending.TryGetValue(challengeId, out var pending)) return false;

        lock (pending.Sync)
        {
            // The same challenge must not succeed twice, even concurrently.
            if (!_pending.TryGetValue(challengeId, out var current) ||
                !ReferenceEquals(current, pending)) return false;

            if (pending.Expires <= DateTimeOffset.UtcNow ||
                pending.FailedAttempts >= 5)
            {
                _pending.TryRemove(challengeId, out _);
                return false;
            }

            pending.FailedAttempts++;
            var supplied = SHA256.HashData(Encoding.UTF8.GetBytes(code.Trim()));
            var verified = string.Equals(pending.Email, email.Trim(),
                    StringComparison.OrdinalIgnoreCase) &&
                code.Length == 6 &&
                CryptographicOperations.FixedTimeEquals(supplied, pending.CodeHash);

            if (verified || pending.FailedAttempts >= 5)
                _pending.TryRemove(challengeId, out _);

            return verified;
        }
    }
}
