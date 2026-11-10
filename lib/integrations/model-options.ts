/** Provider-specific wire options; other compatible providers keep their defaults.
 * DeepSeek docs: https://api-docs.deepseek.com/api/create-chat-completion/
 */
export function modelWireOptions(base: string) {
  return new URL(base).hostname === "api.deepseek.com"
    ? { thinking: { type: "disabled" as const } }
    : {};
}
