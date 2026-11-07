import type { Metadata } from 'next';
import AddressBook from '../../../components/address-book';
import AuthPage from '../../../components/auth-page';

export const metadata: Metadata = {
  title: 'Sổ địa chỉ | Japan Figure',
  description: 'Quản lý các địa chỉ nhận hàng của bạn.',
};

export default function AddressBookPage() {
  return (
    <AuthPage
      title="Sổ địa chỉ"
      description="Chọn địa chỉ Việt Nam theo tỉnh/thành và xã/phường hiện hành."
    >
      <AddressBook />
    </AuthPage>
  );
}
