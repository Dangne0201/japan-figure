import AuthForm from '../../components/auth-form';
import AuthPage from '../../components/auth-page';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthPage title="Xác minh email" description="Xác minh địa chỉ email để kích hoạt tài khoản.">
      <AuthForm mode="verify" token={token} />
    </AuthPage>
  );
}
