import { headers } from "next/headers";
import { Brand } from "@/components/Brand";
export default async function Privacy() {
  const ru = (await headers()).get("host")?.startsWith("ru.");
  return (
    <main className="legal">
      <a href="/">
        <Brand />
      </a>
      <h1>{ru ? "Конфиденциальность" : "Privacy"}</h1>
      {ru ? (
        <>
          <p>
            Мы храним данные аккаунта, загруженные маршруты и заметки, чтобы
            предоставлять сервис. Маршруты приватны, пока вы не создадите
            ссылку.
          </p>
          <p>
            Любой, у кого есть публичная ссылка, может посмотреть, скачать или
            скопировать видимую часть маршрута. Закрытие доступа не удаляет уже
            полученные копии. Скрытие начала и конца снижает раскрытие
            местоположения, но не гарантирует анонимность.
          </p>
          <p>
            Для фоновой карты браузер обращается к OpenStreetMap. Провайдер
            получает IP-адрес и запрошенные области карты. Мы не отправляем ему
            файл маршрута, заметки или секретную ссылку. При входе через Google
            или Apple данные обрабатывает выбранный провайдер. Почта
            доставляется через нашу систему Postal.
          </p>
          <p>
            Для входа используются необходимые cookies. Аналитики и рекламных
            трекеров нет. Вы можете удалить маршрут в приложении. Для удаления
            аккаунта и вопросов напишите на hello@spiderroute.com. Резервные
            копии хранятся до 30 дней.
          </p>
        </>
      ) : (
        <>
          <p>
            We store account details, uploaded routes and notes to provide this
            service. Routes are private until you create a sharing link.
          </p>
          <p>
            Anyone with a public link can view, download or clone its visible
            route. Revoking access cannot remove copies already obtained. Hiding
            endpoints reduces location exposure but does not guarantee
            anonymity.
          </p>
          <p>
            Your browser requests background tiles from OpenStreetMap, which
            receives your IP address and requested map areas. We do not send it
            your route file, notes or secret sharing URL. Google and Apple
            process sign-in information when you use those providers.
            Transactional email is delivered through our Postal system.
          </p>
          <p>
            We use essential sign-in cookies and no advertising or analytics
            trackers. Delete routes in the application. For account deletion or
            questions, contact hello@spiderroute.com. Backups are retained for
            up to 30 days.
          </p>
        </>
      )}
      <a href="mailto:hello@spiderroute.com">hello@spiderroute.com</a>
    </main>
  );
}
