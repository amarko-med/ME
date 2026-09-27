# Supabase setup

This storefront can stay hosted on GitHub Pages. Supabase provides the shared
database, owner authentication, and image storage.

## 1. Create the Supabase project

Create a project on the Supabase Free plan and keep its database password in a
password manager. In **Project Settings → API**, copy the Project URL and the
publishable/anon key. The browser configuration must never contain a
`service_role` or secret key.

## 2. Create the database and storage policies

Open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql),
and run it. It creates the catalog, orders, reviews, row-level security
policies, order RPC functions, and the public image bucket.

## 3. Create the owner account

In **Authentication → Users**, create the owner user with email and password.
Then in SQL Editor, replace the sample address with that exact email and run:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || '{"store_role":"admin"}'::jsonb
where email = 'owner@example.com';
```

Disable public sign-ups in **Authentication → Settings**. The `store_role`
claim is required for owner-only database and image changes.

## 4. Connect the site

Edit [`js/supabase-config.js`](./js/supabase-config.js):

```js
window.MARCHICA_SUPABASE_CONFIG = {
    url: 'https://your-project-ref.supabase.co',
    anonKey: 'your-project-anon-key'
};
```

The anon key is safe to publish only because the schema enables RLS. Never
replace it with a service-role key. Commit and push the configuration with the
rest of the site; GitHub Pages will continue serving the static frontend.

## 5. First synchronization

Open the deployed site, sign in to **Espace propriétaire** using the Supabase
owner account, and allow the first load to finish. If the new database is
empty, the catalog and any browser-local reviews/orders from this device are
copied into Supabase. Afterward, products, categories, banners, settings,
reviews, and orders use the shared database. Product/banner uploads are stored
in Supabase Storage.

Customers can place orders and track them using their order ID and phone
number. Order IDs are random; the public tracking function returns only the
status, items, date, and total, never the customer's address or full contact
record.

## Notes

- Keep the Supabase project URL and anon key in the frontend config; keep all
  database owner credentials private.
- Test a product edit, customer review submission/moderation, order, and
  tracking lookup after setup.
- Supabase Free has quotas and may pause inactive projects. Check the current
  plan limits and keep an independent export of important business records.
