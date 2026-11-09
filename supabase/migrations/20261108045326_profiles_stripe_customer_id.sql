-- P4: checkout needs to remember each user's Stripe customer id across orders,
-- so repeat purchases reuse one Stripe Customer instead of creating a new one each time.
alter table profiles add column stripe_customer_id text;
create unique index profiles_stripe_customer_id_idx on profiles (stripe_customer_id)
  where stripe_customer_id is not null;
