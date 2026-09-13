export type Money = {
  amount: number | null;
  currency: string;
  estimated: boolean;
  source: string | null;
  asOf: string | null;
};

export type BookingInfo = {
  required: boolean;
  url: string | null;
  how: string;
  why: string;
};

export type Transport = {
  mode: string;
  fromPlaceQuery: string;
  toPlaceQuery: string;
  fromStop: string | null;
  toStop: string | null;
  line: string | null;
  operator: string | null;
  durationMin: number | null;
  cost: Money;
  booking: BookingInfo | null;
};

export type Ticket = {
  name: string | null;
  cost: Money;
};

export type Highlight = {
  name: string;
  placeQuery: string;
  stars: number;
  bonus: boolean;
};

export type BackupPlace = {
  title: string;
  displayNameZh: string;
  placeQuery: string;
  type: string;
  notes: string;
  why: string;
  imageUrl: string | null;
  ticket: Ticket;
};

export type TimelineItem = {
  start: string;
  end: string | null;
  endNextDay: boolean;
  type: string;
  title: string;
  placeQuery: string;
  displayNameZh: string;
  mustSee: boolean;
  notes: string;
  locked: boolean;
  imageUrl: string | null;
  transport: Transport;
  ticket: Ticket;
  backups: BackupPlace[];
};

export type Day = {
  day: number;
  date: string;
  title: string;
  stayCity: string;
  countries: string[];
  routeLogic: string;
  tip: string;
  highlights: Highlight[];
  timeline: TimelineItem[];
};

export type HotelCandidate = {
  name: string;
  placeQuery: string;
  stars: number | null;
  cost: Money;
};

export type Night = {
  date: string;
  city: string;
  country: string;
  area: string | null;
  nearPlaceQuery: string | null;
  nearReason: string | null;
  type: string;
  candidates: HotelCandidate[];
  chosenName: string | null;
  transport: Transport | null;
};

export type KlookItem = {
  date: string;
  name: string;
  searchQuery: string;
  placeQuery: string;
  cost: Money;
};

export type Trip = {
  title: string;
  startDate: string;
  endDate: string;
  origin: {
    city: string;
    country: string;
    iata: string | null;
  };
  travelers: {
    adults: number;
    children: number;
  };
  currencies: {
    local: string;
    display: string;
  };
  pace: string;
  language: string;
  notes: string;
};

export type TripDoc = {
  schemaVersion: string;
  trip: Trip;
  days: Day[];
  nights: Night[];
  klook: KlookItem[];
};
