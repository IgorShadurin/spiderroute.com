import { cookies, headers } from "next/headers";
import { Link2Off } from "lucide-react";
import { Brand } from "@/components/Brand";
import { LANGUAGE_KEY } from "@/lib/language";

export default async function UnavailableSet() {
  const preference = (await cookies()).get(LANGUAGE_KEY)?.value;
  const ru =
    preference === "ru" ||
    (!preference &&
      (await headers()).get("accept-language")?.toLowerCase().startsWith("ru"));
  return (
    <div className="sets-page">
      <header className="sets-header">
        <a href="/">
          <Brand />
        </a>
      </header>
      <main className="sets-signin unavailable-set">
        <div className="sets-large-icon">
          <Link2Off size={32} aria-hidden="true" />
        </div>
        <h1>{ru ? "Подборка недоступна" : "Collection unavailable"}</h1>
        <p>
          {ru
            ? "Ссылка неверна или доступ к подборке закрыт. Содержимое по этому адресу сейчас недоступно."
            : "This link is invalid or access has been revoked. The collection is not available at this address."}
        </p>
        <a className="button light" href="/">
          {ru ? "На главную" : "Go to homepage"}
        </a>
      </main>
    </div>
  );
}
