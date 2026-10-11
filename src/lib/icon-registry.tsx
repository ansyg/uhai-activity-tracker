import { IconHome, IconLayers, IconShield, IconUsers, IconComment } from "@/components/icons";

/**
 * Maps a Menu.icon string (plain data, settable from the Roles &
 * Permissions screen with no deploy) to the actual icon component. Add a
 * new icon by adding it here and to ICON_KEYS — nothing else needs to
 * change to offer it on a new menu.
 */
export const ICON_REGISTRY: Record<string, React.ComponentType<{ size?: number }>> = {
  home: IconHome,
  layers: IconLayers,
  shield: IconShield,
  users: IconUsers,
  comment: IconComment,
};

export const ICON_KEYS = Object.keys(ICON_REGISTRY);

/** Falls back to a generic icon for a menu that hasn't picked one (or picked one that's since been removed). */
export function resolveIcon(icon: string | null | undefined): React.ComponentType<{ size?: number }> {
  return (icon && ICON_REGISTRY[icon]) || IconLayers;
}
