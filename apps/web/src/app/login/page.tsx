import AuthForm from '../../components/auth-form';
import AuthPage from '../../components/auth-page';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const candidate = Array.isArray(params.next) ? params.next[0] : params.next;
  const redirectTo =
    candidate?.startsWith('/') && !candidate.startsWith('//') && !candidate.includes('\\')
      ? candidate
      : '/account';

  return (
    <AuthPage
      title="Đăng nhập"
      description="Đăng nhập để quản lý tài khoản của bạn tại Japan Figure."
    >
      <AuthForm mode="login" redirectTo={redirectTo} />
    </AuthPage>
  );
}
