import {
  Youtube,
  Send,
  Instagram,
  Mail,
  UserRound,
  ArrowUpRight,
} from "lucide-react";
import {
  socialNames,
  socialUrl,
  type PublicProfile,
  type SocialKind,
} from "@/lib/profile";
const icons = { youtube: Youtube, telegram: Send, instagram: Instagram };
export function ProfileCard({
  profile,
  ru = false,
}: {
  profile: PublicProfile;
  ru?: boolean;
}) {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  return (
    <section
      className="creator-card"
      aria-label={ru ? "Автор подборки" : "Collection creator"}
    >
      <div className="creator-identity">
        <div className="creator-avatar">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={name}
              referrerPolicy="no-referrer"
            />
          ) : (
            <UserRound size={30} />
          )}
        </div>
        <div>
          <span className="sets-eyebrow">
            {ru ? "ПОДБОРКА ОТ" : "COLLECTED BY"}
          </span>
          <h2>{name}</h2>
          {profile.bio && <p>{profile.bio}</p>}
        </div>
      </div>
      <div className="creator-links">
        {(["youtube", "telegram", "instagram"] as SocialKind[]).map((kind) => {
          const link = profile[kind];
          if (!link.url) return null;
          const Icon = icons[kind];
          let url: string;
          try {
            url = socialUrl(kind, link.url);
          } catch {
            return null;
          }
          return (
            <a
              key={kind}
              href={url}
              target="_blank"
              rel="noopener noreferrer me"
            >
              <Icon size={18} />
              <span>{link.name || socialNames[kind]}</span>
              <ArrowUpRight size={13} />
            </a>
          );
        })}
        {profile.publicEmail && (
          <a href={`mailto:${profile.publicEmail}`}>
            <Mail size={18} />
            <span>{profile.publicEmail}</span>
          </a>
        )}
      </div>
    </section>
  );
}
