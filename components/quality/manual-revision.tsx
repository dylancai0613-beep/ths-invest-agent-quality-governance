"use client";
import { useState } from "react";
export default function ManualRevision({ answer, disabled, onSave }: { answer: string; disabled: boolean; onSave: (text: string, note: string) => Promise<void> }) {
  const [text, setText] = useState(answer);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  return <details className="detail-card"><summary style={{ cursor: "pointer", fontWeight: 600 }}>人工修订回答并复测</summary>
    <p>保存为独立版本，保留源回答、数据快照和修改说明。此操作不调用外部模型。</p>
    <label className="field-label" htmlFor="revision-answer">修订后的回答</label>
    <textarea id="revision-answer" className="field" rows={5} maxLength={8000} value={text} onChange={e => setText(e.target.value)} />
    <label className="field-label" htmlFor="revision-note" style={{ marginTop: 10 }}>修订说明</label>
    <textarea id="revision-note" className="field" rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder="说明修改依据与对应证据…" />
    <button className="btn small primary" style={{ marginTop: 10 }} disabled={disabled || pending || !text.trim() || !note.trim()} onClick={async () => { setPending(true); try { await onSave(text, note); } finally { setPending(false); } }}>{pending ? "正在保存与复测…" : "保存修订并复测"}</button>
  </details>;
}
