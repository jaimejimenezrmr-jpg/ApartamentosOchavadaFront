import { buildContentSecurityPolicy, injectNonce } from './csp';

describe('CSP', () => {
  it('añade el nonce solo a los scripts en línea', () => {
    const html = '<script>a()</script><script src="/main.js" type="module"></script>'
      + '<script type="application/json" id="ng-state">{}</script><script nonce="x">b()</script>';
    const out = injectNonce(html, 'abc');
    expect(out).toContain('<script nonce="abc">a()</script>');
    expect(out).toContain('<script src="/main.js" type="module"></script>');
    expect(out).toContain('<script nonce="abc" type="application/json" id="ng-state">');
    expect(out).toContain('<script nonce="x">b()</script>');
  });

  it('no permite scripts en línea sin nonce ni eval', () => {
    const csp = buildContentSecurityPolicy('n1');
    const scripts = csp.split('; ').find((d) => d.startsWith('script-src'))!;
    expect(scripts).toContain("'nonce-n1'");
    expect(scripts).toContain('https://js.stripe.com');
    expect(scripts).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
