type Plugin = {
  code: string;
  name: string;
  category: string;
  provider: string;
  config: Record<string, unknown> | null;
};

function waLink(phone: string, message: string) {
  const digits = phone.replace(/[^\d]/g, '');
  const text = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${text}`;
}

export function ChatPlugins({ plugins }: { plugins: Plugin[] }) {
  const whatsapp = plugins.find((p) => p.code === 'whatsapp_chat');
  const facebook = plugins.find((p) => p.code === 'facebook_chat');

  const waPhone = String(whatsapp?.config?.phoneE164 ?? '');
  const waMessage = String(whatsapp?.config?.prefilledMessage ?? 'Hi');
  const waLabel = String(whatsapp?.config?.buttonLabel ?? 'Chat on WhatsApp');

  const fbUrl = String(
    facebook?.config?.messengerUrl || facebook?.config?.pageUrl || '',
  );
  const showFb = Boolean(facebook && facebook.config?.showFloatingButton && fbUrl);

  if (!whatsapp && !showFb) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      {showFb && (
        <a
          href={fbUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-[#1877F2] px-4 py-2.5 text-sm font-medium text-white shadow-lg transition hover:opacity-90"
        >
          Facebook
        </a>
      )}
      {whatsapp && waPhone && (
        <a
          href={waLink(waPhone, waMessage)}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white shadow-lg transition hover:opacity-90"
        >
          {waLabel}
        </a>
      )}
    </div>
  );
}
