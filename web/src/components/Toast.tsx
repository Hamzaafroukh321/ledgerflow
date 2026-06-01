export interface ToastMessage {
  tone: "success" | "error" | "info";
  title: string;
  detail?: string;
}

export function Toast({ message }: { message?: ToastMessage }) {
  if (!message) {
    return null;
  }

  const toneClass = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-950",
    error: "border-rose-200 bg-rose-50 text-rose-950",
    info: "border-sky-200 bg-sky-50 text-sky-950"
  }[message.tone];

  return (
    <div className={`fixed bottom-4 right-4 max-w-sm rounded-md border p-4 shadow-lg ${toneClass}`} role="status">
      <p className="font-semibold">{message.title}</p>
      {message.detail ? <p className="mt-1 text-sm opacity-80">{message.detail}</p> : null}
    </div>
  );
}
