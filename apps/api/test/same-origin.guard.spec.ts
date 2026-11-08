import { ForbiddenException } from '@nestjs/common';
import { assertSameOriginForCookieMutation } from '../src/auth/same-origin.guard';

const webOrigin = 'https://shop.example';

describe('same-origin protection for cookie-authenticated mutations', () => {
  it('allows a state-changing request with the configured origin', () => {
    expect(() =>
      assertSameOriginForCookieMutation(
        {
          method: 'POST',
          headers: { cookie: 'jf_access=token; jf_refresh=refresh', origin: webOrigin },
        },
        webOrigin,
      ),
    ).not.toThrow();
  });

  it('rejects a sibling-origin request even when browser cookies are present', () => {
    expect(() =>
      assertSameOriginForCookieMutation(
        {
          method: 'POST',
          headers: { cookie: 'jf_access=token', origin: 'https://attacker.example' },
        },
        webOrigin,
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects cookie-authenticated mutations without an Origin header', () => {
    expect(() =>
      assertSameOriginForCookieMutation(
        { method: 'DELETE', headers: { cookie: 'jf_refresh=refresh' } },
        webOrigin,
      ),
    ).toThrow(ForbiddenException);
  });

  it('does not require a browser origin for unauthenticated API clients', () => {
    expect(() =>
      assertSameOriginForCookieMutation({ method: 'POST', headers: {} }, webOrigin),
    ).not.toThrow();
  });

  it('does not block safe requests based on their origin', () => {
    expect(() =>
      assertSameOriginForCookieMutation(
        {
          method: 'GET',
          headers: { cookie: 'jf_access=token', origin: 'https://attacker.example' },
        },
        webOrigin,
      ),
    ).not.toThrow();
  });

  it('normalizes default ports when comparing origins', () => {
    expect(() =>
      assertSameOriginForCookieMutation(
        {
          method: 'PATCH',
          headers: { cookie: 'jf_access=token', origin: 'https://shop.example:443' },
        },
        webOrigin,
      ),
    ).not.toThrow();
  });
});
