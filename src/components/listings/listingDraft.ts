/**
 * The listing editor's working state, and the diff that turns it into a write.
 *
 * Saving is partial on the server (a half-written draft saves; completeness is
 * judged at submit), so the editor sends only what changed. That matters most
 * on a LIVE listing: its first write opens a revision for review, and an
 * untouched contact echoed back would be a change a reviewer has to look at.
 */

import { toCategoryWire, fromProductCategories, sameCategoryWire } from '@/services/categories.service';
import { descriptionCreateWire, descriptionUpdateWire } from '@/lib/richtext/wire';
import { EMPTY_DOC, hydrateDoc, isEmptyDoc, type RichDoc } from '@/lib/richtext';
import type { CategoryEntry } from '@/types/category.types';
import type { FileRef } from '@/types/file.types';
import type { GeoAddress } from '@/types/geo.types';
import type {
  ListingContactsInput,
  ListingContentInput,
  ListingOpeningHours,
  ListingSocialLink,
  ListingWriteInput,
  VendorListingDetail,
} from '@/types/listings.types';

export interface ListingDraft {
  title: string;
  companyName: string;
  categories: CategoryEntry[];
  country: string;
  city: string;
  area: string;
  description: RichDoc;
  photoIds: string[];
  openingHours: ListingOpeningHours[] | null;
  // Hidden contacts — `''` = none.
  whatsapp: string;
  phone: string;
  phone2: string;
  email: string;
  website: string;
  socials: ListingSocialLink[];
  location: GeoAddress | null;
  videoUrl: string;
}

export function emptyDraft(country: string, companyName: string): ListingDraft {
  return {
    title: '',
    companyName,
    categories: [],
    country,
    city: '',
    area: '',
    description: EMPTY_DOC,
    photoIds: [],
    openingHours: null,
    whatsapp: '',
    phone: '',
    phone2: '',
    email: '',
    website: '',
    socials: [],
    location: null,
    videoUrl: '',
  };
}

/** The version being edited: the working copy when there is one, else the approved one. */
export function draftFromDetail(d: VendorListingDetail): { draft: ListingDraft; photos: FileRef[] } {
  const c = d.pending ?? d.published;
  const k = d.contacts.pending ?? d.contacts.published;
  return {
    photos: c?.photos ?? [],
    draft: {
      title: c?.title ?? '',
      companyName: c?.companyName ?? '',
      categories: fromProductCategories(c?.categories),
      country: c?.country ?? '',
      city: c?.city ?? '',
      area: c?.area ?? '',
      description: hydrateDoc(c?.descriptionRich ?? null, c?.description ?? ''),
      photoIds: c?.photoFileIds ?? [],
      openingHours: c?.openingHours ?? null,
      whatsapp: k?.whatsapp ?? '',
      phone: k?.phone ?? '',
      phone2: k?.phone2 ?? '',
      email: k?.email ?? '',
      website: k?.website ?? '',
      socials: k?.socials ?? [],
      location: k?.location ?? null,
      videoUrl: k?.video?.url ?? '',
    },
  };
}

/** A default week for "Add opening hours": Monday–Saturday 08:00–18:00, Sunday closed. */
export function defaultWeek(): ListingOpeningHours[] {
  return (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => ({
    day,
    openTime: '08:00',
    closeTime: '18:00',
    isClosed: day === 'sunday',
  }));
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const orNull = (v: string) => (v.trim() === '' ? null : v.trim());

/** Social rows with no link are not sent — an empty row is "not filled in yet". */
const cleanSocials = (rows: ListingSocialLink[]) =>
  rows.filter((r) => r.url.trim() !== '').map((r) => ({ network: r.network, url: r.url.trim() }));

/** The location as the server takes it: what the address search returned, minus `resolved_at`. */
function locationWire(g: GeoAddress | null): ListingContactsInput['location'] {
  if (!g) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { resolved_at, ...rest } = g;
  return rest;
}

function samePlace(a: GeoAddress | null, b: GeoAddress | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.formatted_address === b.formatted_address &&
    same(a.coordinates?.coordinates, b.coordinates?.coordinates)
  );
}

/**
 * The write for this draft. With `initial` it is the diff against it (an edit);
 * without, everything filled in (a create). `categories` overrides the chips —
 * the "Did you mean …?" loop re-sends with rewritten ones.
 */
export function buildListingWrite(
  draft: ListingDraft,
  initial: ListingDraft | null,
  categories: CategoryEntry[] = draft.categories,
): ListingWriteInput {
  const content: ListingContentInput = {};
  const contacts: ListingContactsInput = {};
  const changed = <K extends keyof ListingDraft>(key: K) => !initial || !same(draft[key], initial[key]);

  if (changed('title') && (initial || draft.title.trim())) content.title = draft.title.trim();
  if (changed('companyName') && (initial || draft.companyName.trim())) content.companyName = draft.companyName.trim();
  if (
    initial
      ? !sameCategoryWire(categories, initial.categories)
      : categories.length > 0
  ) {
    content.categories = toCategoryWire(categories);
  }
  if (changed('country') && draft.country) content.country = draft.country;
  if (changed('city') && (initial || draft.city.trim())) content.city = draft.city.trim();
  if (changed('area') && (initial || draft.area.trim())) content.area = draft.area.trim();
  if (initial) {
    Object.assign(content, descriptionUpdateWire(draft.description, initial.description));
  } else if (!isEmptyDoc(draft.description)) {
    Object.assign(content, descriptionCreateWire(draft.description));
  }
  if (changed('photoIds') && (initial || draft.photoIds.length)) content.photoFileIds = draft.photoIds;
  if (changed('openingHours') && (initial || draft.openingHours)) content.openingHours = draft.openingHours;

  for (const key of ['whatsapp', 'phone', 'phone2', 'email', 'website'] as const) {
    if (changed(key) && (initial || draft[key].trim())) contacts[key] = orNull(draft[key]);
  }
  const socials = cleanSocials(draft.socials);
  if (!initial ? socials.length > 0 : !same(socials, cleanSocials(initial.socials))) contacts.socials = socials;
  if (!initial ? !!draft.location : !samePlace(draft.location, initial.location)) {
    contacts.location = locationWire(draft.location);
  }
  if (changed('videoUrl') && (initial || draft.videoUrl.trim())) {
    contacts.video = draft.videoUrl.trim() ? { url: draft.videoUrl.trim() } : null;
  }

  const out: ListingWriteInput = {};
  if (Object.keys(content).length) out.content = content;
  if (Object.keys(contacts).length) out.contacts = contacts;
  return out;
}

export function isEmptyWrite(w: ListingWriteInput): boolean {
  return !w.content && !w.contacts;
}
