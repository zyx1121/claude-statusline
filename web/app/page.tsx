import {
  getRegistry,
  getOctants,
  localizedName,
  localizedDescription,
} from "@/lib/registry";
import { getLocale } from "@/lib/i18n";
import {
  StatuslinePlayground,
  type PlaygroundComponent,
  type PlaygroundProfile,
} from "@/components/playground/statusline-playground";

// Federated registry is fetched at request time (revalidated).
export const revalidate = 600;

export default async function Home() {
  const locale = await getLocale();
  const reg = await getRegistry();
  const octants = getOctants();

  const components: PlaygroundComponent[] = reg.components.map((component) => ({
    id: component.id,
    name: localizedName(component, locale),
    description: localizedDescription(component, locale),
    type: component.type,
    runtime: component.runtime,
    author: component.author,
    official: component.official,
    preview: component.preview,
    frames: component.frames,
    mosaic: component.mosaic,
    network: component.network,
    needsSecrets: component.needsSecrets,
    hasFetch: component.hasFetch,
    placement: component.placement,
  }));

  const profiles: PlaygroundProfile[] = reg.profiles.map((profile) => ({
    name: profile.name,
    description: profile.description,
    components: profile.components,
  }));

  return (
    <StatuslinePlayground
      components={components}
      profiles={profiles}
      octants={octants}
      stats={{ components: reg.components.length, authors: reg.byAuthor.length }}
    />
  );
}
