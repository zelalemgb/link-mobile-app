const config = require("./app.json");

module.exports = ({ config: expoConfig }) => ({
  ...expoConfig,
  extra: {
    EXPO_PUBLIC_SUPABASE_URL:
      process.env.EXPO_PUBLIC_SUPABASE_URL ||
      "https://qxihedrgltophafkuasa.supabase.co",
    EXPO_PUBLIC_SUPABASE_ANON_KEY:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4aWhlZHJnbHRvcGhhZmt1YXNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyMzA1NTcsImV4cCI6MjA2NzgwNjU1N30.Vcf3LHMvucji5JPYxd30BZFlKxRd6E7OcJSQh8fpo1Q",
    EXPO_PUBLIC_API_BASE_URL:
      process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.linkhc.org/api",
    EXPO_PUBLIC_MEDGEMMA_API_URL:
      process.env.EXPO_PUBLIC_MEDGEMMA_API_URL ||
      "https://api.linkhc.org/api/ai/analyze",
  },
});
