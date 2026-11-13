import { describe, expect, it } from 'vitest';
import { airbnb, airbnbFits, booking, googleFlights, googleMaps, isIsoDate, skyscanner, validRange } from './links';

describe('datum', () => {
  it('känner igen giltiga datum', () => {
    expect(isIsoDate('2027-05-13')).toBe(true);
    expect(isIsoDate('2027-02-30')).toBe(false);
    expect(isIsoDate('13/5')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });

  it('hemdatum får inte vara före utresan', () => {
    expect(validRange('2027-05-13', '2027-05-16')).toBe(true);
    expect(validRange('2027-05-13', '2027-05-10')).toBe(false);
    expect(validRange('2027-05-13')).toBe(true);
  });
});

describe('flyg', () => {
  const s = { from: 'GOT', to: 'ams', out: '2027-05-13', home: '2027-05-16' };

  it('Google Flights med avreseort, mål och datum', () => {
    const u = new URL(googleFlights(s));
    expect(u.origin + u.pathname).toBe('https://www.google.com/travel/flights');
    expect(u.searchParams.get('q')).toBe('Flights to AMS from GOT on 2027-05-13 through 2027-05-16');
    expect(u.searchParams.get('curr')).toBe('SEK');
  });

  it('Google Flights enkel resa', () => {
    expect(new URL(googleFlights({ ...s, home: undefined })).searchParams.get('q')).toBe('Flights to AMS from GOT on 2027-05-13');
  });

  it('Skyscanner med datum som ÅÅMMDD', () => {
    expect(skyscanner(s)).toBe('https://www.skyscanner.se/transport/flights/got/ams/270513/270516/?adultsv2=1&currency=SEK');
    expect(skyscanner({ ...s, from: 'CPH', home: undefined })).toBe(
      'https://www.skyscanner.se/transport/flights/cph/ams/270513/?adultsv2=1&currency=SEK',
    );
  });
});

describe('boende', () => {
  const s = { place: 'Göteborg', checkin: '2027-05-13', checkout: '2027-05-16', adults: 2, rooms: 1 };

  it('Booking med datum, gäster, rum, maxpris och typ', () => {
    const u = new URL(booking({ ...s, maxPrice: 1500, type: 'hotell' }));
    expect(u.hostname).toBe('www.booking.com');
    expect(u.searchParams.get('ss')).toBe('Göteborg');
    expect(u.searchParams.get('checkin')).toBe('2027-05-13');
    expect(u.searchParams.get('checkout')).toBe('2027-05-16');
    expect(u.searchParams.get('group_adults')).toBe('2');
    expect(u.searchParams.get('no_rooms')).toBe('1');
    expect(u.searchParams.get('nflt')).toBe('price=SEK-min-1500-1;ht_id=204');
  });

  it('Booking utan filter när typen är alla och maxpris saknas', () => {
    expect(new URL(booking(s)).searchParams.has('nflt')).toBe(false);
  });

  it('Booking håller gäster och rum inom rimliga gränser', () => {
    const u = new URL(booking({ ...s, adults: 0, rooms: 99 }));
    expect(u.searchParams.get('group_adults')).toBe('1');
    expect(u.searchParams.get('no_rooms')).toBe('30');
  });

  it('Airbnb med datum, gäster och maxpris', () => {
    const u = new URL(airbnb({ ...s, maxPrice: 1200 }));
    expect(u.pathname).toBe(`/s/${encodeURIComponent('Göteborg')}/homes`);
    expect(u.searchParams.get('checkin')).toBe('2027-05-13');
    expect(u.searchParams.get('adults')).toBe('2');
    expect(u.searchParams.get('price_max')).toBe('1200');
  });

  it('Airbnb passar för lägenhet och alla typer', () => {
    expect(airbnbFits('lagenhet')).toBe(true);
    expect(airbnbFits('alla')).toBe(true);
    expect(airbnbFits('hotell')).toBe(false);
  });
});

describe('kartor', () => {
  it('Google Maps-sökning med och utan koordinater', () => {
    expect(googleMaps('Borås')).toBe('https://www.google.com/maps/search/?api=1&query=Bor%C3%A5s');
    expect(new URL(googleMaps('Rijksmuseum', 52.36, 4.885)).searchParams.get('query')).toBe('Rijksmuseum 52.36,4.885');
  });
});
