/**
 * Group trips (Phase 4, UC-T01 to UC-T05): plan a trip, find people to go
 * with, split expenses, vote on activities and settle up.
 */
import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import type { ApiResponse } from '../types/api';

export type TripType = 'vacation' | 'weekend' | 'business';
export type TripVote = 'yes' | 'no' | 'maybe';
export const TRIP_INTERESTS = ['hiking', 'culture', 'food', 'beach', 'adventure', 'nightlife', 'shopping', 'photography', 'wildlife', 'spiritual', 'relaxation'] as const;

type Person = { _id: string; name?: string; profilePhotoUrl?: string; stats?: { avgRatingAsOrganizer?: number; totalRatingsAsOrganizer?: number } };

export interface Trip {
  _id: string;
  organizer: Person | string;
  title: string;
  description?: string;
  tripType: TripType;
  startDate: string;
  endDate: string;
  destinations: Array<{ name: string }>;
  budgetPerPerson?: number;
  interests: string[];
  itinerary: Array<{ day: number; title: string; notes?: string }>;
  maxGroupSize: number;
  visibility: 'public' | 'private';
  inviteCode?: string;
  status: 'planning' | 'ongoing' | 'completed' | 'cancelled';
  members: Array<{ user: Person; role: 'organizer' | 'member'; upiId?: string }>;
  joinRequests: Array<{ _id: string; user: Person; message?: string; at: string }>;
  activities: Array<{
    _id: string;
    title: string;
    date?: string;
    cost?: number;
    durationMins?: number;
    notes?: string;
    proposedBy: string;
    votes: Array<{ user: string; vote: TripVote }>;
    status: 'proposed' | 'confirmed' | 'rejected';
  }>;
  isMember?: boolean;
  isOrganizer?: boolean;
  myRequestStatus?: 'pending' | 'accepted' | 'declined';
  viewerId?: string;
  /** After the trip: whether the viewer can still rate the organiser, and their rating */
  canRateOrganizer?: boolean;
  myOrganizerRating?: { score: number; comment?: string };
  /** Search results only */
  compatibility?: number;
  spotsLeft?: number;
  /** My trips only */
  pendingRequests?: number;
}

export interface TripExpense {
  _id: string;
  description: string;
  amount: number;
  paidBy: Person;
  splitAmong: string[];
  createdBy: string;
  spentAt: string;
}

export interface Settlement {
  total: number;
  perPerson: number;
  members: Array<{ userId: string; name: string; paid: number; share: number; balance: number }>;
  transfers: Array<{ from: string; to: string; amount: number; fromName?: string; toName?: string; upiLink?: string }>;
}

export type TripInput = Pick<Trip, 'title' | 'tripType' | 'startDate' | 'endDate' | 'destinations' | 'interests' | 'itinerary' | 'maxGroupSize' | 'visibility'> & {
  description?: string;
  budgetPerPerson?: number;
};

const data = <T,>(p: Promise<{ data: ApiResponse<T> }>) => p.then(r => r.data.data);

export const tripService = {
  create: (input: TripInput) => data<{ trip: Trip }>(apiClient.post(API_ENDPOINTS.trips.base, input)).then(d => d.trip),
  search: (q: { destination?: string; from?: string; to?: string; interests?: string[]; maxBudget?: number }) =>
    data<{ trips: Trip[] }>(apiClient.get(API_ENDPOINTS.trips.search, { params: { ...q, interests: q.interests?.join(',') || undefined } })).then(d => d.trips),
  mine: () => data<{ trips: Trip[] }>(apiClient.get(API_ENDPOINTS.trips.mine)).then(d => d.trips),
  byInvite: (code: string) => data<{ trip: Trip }>(apiClient.get(API_ENDPOINTS.trips.invite(code.trim()))).then(d => d.trip),
  get: (id: string, code?: string) => data<{ trip: Trip }>(apiClient.get(API_ENDPOINTS.trips.detail(id), { params: { code } })).then(d => d.trip),
  update: (id: string, changes: Partial<TripInput> & { status?: Trip['status'] }) => data<{ trip: Trip }>(apiClient.patch(API_ENDPOINTS.trips.detail(id), changes)).then(d => d.trip),
  join: (id: string, message?: string, code?: string) => data<{ status: string }>(apiClient.post(API_ENDPOINTS.trips.join(id), { message, code })),
  respond: (id: string, requestId: string, accept: boolean) => data<{ trip: Trip }>(apiClient.post(API_ENDPOINTS.trips.respond(id, requestId), { accept })).then(d => d.trip),
  leave: (id: string) => data<{ left: boolean }>(apiClient.post(API_ENDPOINTS.trips.leave(id), {})),
  setUpi: (id: string, upiId: string) => data<{ upiId?: string }>(apiClient.put(API_ENDPOINTS.trips.upi(id), { upiId })),
  expenses: (id: string) => data<{ expenses: TripExpense[] }>(apiClient.get(API_ENDPOINTS.trips.expenses(id))).then(d => d.expenses),
  addExpense: (id: string, e: { description: string; amount: number; paidBy?: string; splitAmong?: string[] }) =>
    data<{ expense: TripExpense }>(apiClient.post(API_ENDPOINTS.trips.expenses(id), e)).then(d => d.expense),
  deleteExpense: (id: string, expenseId: string) => data<{ removed: boolean }>(apiClient.delete(API_ENDPOINTS.trips.expense(id, expenseId))),
  settlement: (id: string) => data<Settlement>(apiClient.get(API_ENDPOINTS.trips.settlement(id))),
  markSettled: (id: string, t: { from: string; to: string; amount: number }) => data<Settlement>(apiClient.post(API_ENDPOINTS.trips.settle(id), t)),
  notifyAll: (id: string) => data<{ notified: number }>(apiClient.post(API_ENDPOINTS.trips.notify(id), {})),
  propose: (id: string, a: { title: string; date?: string; cost?: number; notes?: string }) =>
    data<{ activity: Trip['activities'][number] }>(apiClient.post(API_ENDPOINTS.trips.activities(id), a)).then(d => d.activity),
  vote: (id: string, activityId: string, vote: TripVote) =>
    data<{ activity: Trip['activities'][number] }>(apiClient.post(API_ENDPOINTS.trips.vote(id, activityId), { vote })).then(d => d.activity),
  rateOrganizer: (id: string, score: number, comment?: string) =>
    data<{ rated: boolean }>(apiClient.post(API_ENDPOINTS.trips.rateOrganizer(id), { score, comment })),
  /** A private calendar feed of the trip and its confirmed activities */
  calendarLink: (id: string) => data<{ url: string; webcalUrl: string }>(apiClient.get(API_ENDPOINTS.trips.calendarLink(id))),
};

export const tripDays = (t: Pick<Trip, 'startDate' | 'endDate'>) =>
  Math.round((new Date(t.endDate).getTime() - new Date(t.startDate).getTime()) / 86_400_000) + 1;

export const tripDates = (t: Pick<Trip, 'startDate' | 'endDate'>) => {
  const f = (d: string) => new Date(d).toLocaleDateString([], { day: 'numeric', month: 'short' });
  return t.startDate.slice(0, 10) === t.endDate.slice(0, 10) ? f(t.startDate) : `${f(t.startDate)} to ${f(t.endDate)}`;
};
