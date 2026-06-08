"use client";

import { FormEvent, useState } from "react";
import { Send } from "lucide-react";

const recipient = "amy191933@gmail.com";

export function ContactMailForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subject = encodeURIComponent(`神明便利貼官網訊息 - ${name || "訪客"}`);
    const body = encodeURIComponent(
      [`姓名：${name || "未填寫"}`, `Email：${email || "未填寫"}`, "", "訊息內容：", message || "未填寫"].join("\n")
    );
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-4 rounded-lg border border-orange-100 bg-white p-6 shadow-soft">
      <input className="input" placeholder="姓名" value={name} onChange={(event) => setName(event.target.value)} />
      <input className="input" placeholder="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <textarea
        className="input min-h-36"
        placeholder="想詢問合作、客製、商品或其他問題，都可以寫在這裡。"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        required
      />
      <button className="btn-primary w-fit" type="submit">
        <Send size={18} />
        寄出 Email
      </button>
    </form>
  );
}
