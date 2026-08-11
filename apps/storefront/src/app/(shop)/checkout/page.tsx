import { CheckoutFlow } from '@/components/checkout-flow';
import { CheckoutSignIn } from '@/components/checkout-sign-in';
import { getCustomerSession } from '@/lib/auth';

export default async function CheckoutPage() {
  const customer = await getCustomerSession();

  if (!customer) {
    return <CheckoutSignIn />;
  }

  return (
    <CheckoutFlow
      customer={{
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
      }}
    />
  );
}
