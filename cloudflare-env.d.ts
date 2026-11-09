declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    IFIND_MCP_TOKEN?: string;
    MODEL_API_BASE?: string;
    MODEL_API_KEY?: string;
    MODEL_NAME?: string;
  }
}
