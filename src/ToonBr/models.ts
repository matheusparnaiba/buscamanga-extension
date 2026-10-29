/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const CATEGORY_OPTIONS: Tag[] = [
  { id: "all", title: "Todas as Categorias" },
  { id: "9c302e17-a1df-42f7-84f9-8de76bc97afb", title: "Ação" },
  { id: "016c5ed9-8471-4a53-ad4e-22108ddc7cef", title: "Artes Marciais" },
  { id: "02aa6ee2-1862-4044-a81c-7417b588d096", title: "Aventura" },
  { id: "148ba9b3-1353-430e-ab3d-e845cfb35a77", title: "Comédia" },
  { id: "541d75e5-233d-42f7-8a9e-77f3f0674c25", title: "Cultivo" },
  { id: "e36a8377-378f-472c-a622-a36ed0de493a", title: "Drama" },
  { id: "c6f1d753-cfd4-4e5c-bbfa-45a742d416c8", title: "Dungeons" },
  { id: "152d8043-499f-46af-bcb1-fa85d4609b06", title: "Fantasia" },
  { id: "15b9f655-752a-43d2-be81-fcade4b88600", title: "Ficção Científica" },
  { id: "8881c693-f64d-4c7c-854e-d36d766e4c94", title: "Garota Monstro" },
  { id: "276ad40f-6a47-4e95-86b5-edd05a13758e", title: "Guerra" },
  { id: "804d6052-4b08-4690-b068-bb0c419bd3e7", title: "Harém" },
  { id: "a25e9dc7-4542-4e12-bc62-13b26012f817", title: "Histórico" },
  { id: "7fc49228-f081-4829-bae0-124c72b6d3b1", title: "Isekai" },
  { id: "56d5c790-8cdb-4856-a7c0-a05d9f9ac27f", title: "Josei" },
  { id: "bcf9fbae-b594-45ef-88d3-2238e6e69d0b", title: "Magia" },
  { id: "630647d8-0644-479d-bb4f-dd93bdc2f260", title: "Manhua" },
  { id: "78285b9f-1ffa-4f8e-a364-1f5c474e0c42", title: "Mistério" },
  { id: "f023cc3a-e739-434f-b9a7-ebdb6820012e", title: "Murim" },
  { id: "36737e8e-bd53-49c6-9778-b068a7e1af33", title: "Novel" },
  { id: "b7d6eaa1-9f63-4954-9337-7d3ff8db28da", title: "Overpower" },
  { id: "798e2caa-b993-4d02-82f6-9ca1670b6f9c", title: "Poderes" },
  { id: "aab7e8c0-9947-4940-9df1-66fab2cfa9e0", title: "Psicológico" },
  { id: "015f5641-f9ab-49b5-8e40-7e3ab11d6841", title: "Reencarnação" },
  { id: "378bf675-df29-4e83-969c-baa9cb704ebe", title: "Regressão" },
  { id: "d551ebe5-18bc-4e43-b8dc-b8cc0ca338e9", title: "Retorno" },
  { id: "1572cea3-6b8d-4384-869e-98f13eeb0b72", title: "Romance" },
  { id: "201ba651-1538-4ba9-8d38-2bf27ef021fa", title: "Seinen" },
  { id: "b555b360-813b-4996-886c-f6c2b18f1627", title: "Shoujo" },
  { id: "0c496918-8310-4faa-a578-5146869beaf1", title: "Shounen" },
  { id: "9b34cfee-ab0f-4111-b65f-f124f1efd4e5", title: "Sistema" },
  { id: "9b4eac41-405d-4add-92bb-ca4de396d06e", title: "Slice of Life" },
  { id: "4640673a-1697-4a1b-bc0f-449b85088639", title: "Sobrenatural" },
  { id: "575d014e-fb7a-43fc-9f9d-883fdd789c90", title: "Superpoderes" },
  { id: "b67c12d8-89ae-491a-b902-d616c6d52c49", title: "Terror" },
  { id: "a8beff9f-bc9f-45f7-b733-487d7365b153", title: "Torre" },
  { id: "392a32a3-0bef-4f97-bb2f-5854f1701a21", title: "Transformação" },
  { id: "f1189c95-a9ad-43cd-9973-85f1c9000953", title: "Tragédia" },
  { id: "22bce1fa-5c06-45f1-a366-99f4556646fa", title: "Vilão" },
  { id: "49073ee7-379c-4c59-9379-757b5e9abd32", title: "Vingança" },
  { id: "4e7b53c7-cc94-4967-859c-6be94bf3a52e", title: "Wuxia" },
];

export type ToonBrSearchMetadata = {
  [key: string]: any;
  categoryId?: string;
};

export interface ToonBrCategoryDto {
  id: string;
  name: string;
}

export interface ToonBrChapterDto {
  id: string;
  title: string;
  chapterNumber?: number;
  createdAt?: string;
  pages?: ToonBrPageDto[];
}

export interface ToonBrPageDto {
  id?: string;
  imageUrl?: string;
  pageNumber?: number;
}

export interface ToonBrMangaDto {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  status?: string | null;
  coverImage?: string | null;
  author?: string | null;
  artist?: string | null;
  categories?: ToonBrCategoryDto[];
  latestChapter?: {
    id: string;
    title: string;
    chapterNumber: number;
    createdAt?: string;
  };
  chapters?: ToonBrChapterDto[];
}

export interface ToonBrMangaListResponse {
  data: ToonBrMangaDto[];
}
