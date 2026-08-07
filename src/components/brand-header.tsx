import Image from "next/image";
import Link from "next/link";

export function BrandHeader({ quietLabel, landing = false }: { quietLabel?: string; landing?: boolean }) {
  return (
    <header className={landing ? "bg-[var(--green)] px-5 pt-4 sm:px-6 sm:pt-5" : "border-b border-black/10 border-t-[3px] border-t-[var(--green)] bg-white"}>
      <div className={`mx-auto flex max-w-6xl items-center justify-between ${landing ? "h-[4.5rem] rounded-full bg-white/50 px-6 sm:px-8" : "h-20 px-5 sm:px-6"}`}>
        <Link href="/" className="flex items-center" aria-label="Teracube Device Care home">
          {landing ? <Image
            src="/brand/teracube-wordmark.png"
            alt="Teracube"
            width={176}
            height={25}
            priority
            className="h-auto w-36 object-contain sm:w-44"
          /> : <><Image
            src="/brand/teracube-logo.png"
            alt="Teracube"
            width={200}
            height={200}
            priority
            className="size-[4.25rem] object-contain"
          />
          <div className="ml-3 border-l border-black/15 pl-3">
            <p className="text-sm font-semibold tracking-[-0.01em] text-black/75">Device Care</p>
            <p className="mt-0.5 hidden text-xs text-black/45 sm:block">Repairs &amp; replacements</p>
          </div></>}
        </Link>
        {quietLabel ? <p className={`text-xs font-medium sm:text-sm ${landing ? "text-black/65" : "text-black/45"}`}>{quietLabel}</p> : null}
      </div>
    </header>
  );
}
