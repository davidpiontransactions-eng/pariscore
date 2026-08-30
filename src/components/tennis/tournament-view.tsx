"use client";

import { TournamentDrawView } from "./tournament-draw-view";

type Props = { slug: string };

export function TournamentView({ slug }: Props) {
  return <TournamentDrawView slug={slug} />;
}
