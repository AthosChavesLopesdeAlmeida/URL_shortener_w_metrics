import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'sid';
const AUTH_PAGES = ['/login', '/register'];

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isAuthPage = AUTH_PAGES.includes(pathname);

  // Página protegida sem cookie: vai para o login, lembrando de onde veio
  if (!isAuthPage && !hasSession) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // Já logado tentando abrir login/registro: vai para a área protegida.
  // `expired` evita o loop quando o cookie existe mas a sessão já morreu no Redis.
  if (isAuthPage && hasSession && !searchParams.has('expired')) {
    return NextResponse.redirect(new URL('/create', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/create/:path*', '/links/:path*', '/acc/:path*', '/login', '/register'],
};