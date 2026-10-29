/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "recent", title: "Mais Recentes" },
  { id: "popular", title: "Mais Populares" },
];

export type ContentTemplateSearchMetadata = {
  [key: string]: any;
  orderBy?: string;
};

export interface RFProjectDto {
  id: string;
  title: string;
  cover_image?: string | null;
  link: string;
  status?: string | null;
}

export interface RFPaginationDto {
  hasNextPage?: boolean;
}

export interface RFProjectsPageDto {
  projects?: RFProjectDto[];
  pagination?: RFPaginationDto;
}

export interface RFNameDto {
  name?: string | null;
}

export interface RFMangaDetailsDto {
  title?: string | null;
  synopsis?: string | null;
  cover_image?: string | null;
  status?: string | null;
  authors?: RFNameDto[] | null;
  artists?: RFNameDto[] | null;
  genders?: RFNameDto[] | null;
}

export interface RFChapterDataDto {
  title?: string | number | null;
  created_at?: string | null;
  isUpcoming?: boolean | null;
  hasRestriction?: boolean | null;
}

export interface RFSeasonGroupDto {
  chapters?: RFChapterDataDto[] | null;
}

export interface RFSeasonListDto {
  groups?: RFSeasonGroupDto[] | null;
}

export interface RFPageDataDto {
  photo?: string | null;
}

export interface RFPagesDto {
  pages?: RFPageDataDto[] | null;
}
