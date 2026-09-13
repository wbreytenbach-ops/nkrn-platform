using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NKRN.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialBaseline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The Tygerpoort_ITDesk database already exists.
            // This migration only establishes the EF Core baseline.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentionally empty.
            // The baseline must not delete the existing database schema.
        }
    }
}