-- Marchica Equipement Supabase schema.
-- Run this once in the Supabase SQL Editor before configuring the site.

create table if not exists public.storefront_data (
    key text primary key check (key in ('products', 'categories', 'hero_slides', 'shop_settings')),
    value jsonb not null,
    updated_at timestamptz not null default now()
);

create table if not exists public.product_reviews (
    id text primary key,
    product_id text not null,
    customer_name text not null check (char_length(customer_name) between 1 and 80),
    rating smallint not null check (rating between 1 and 5),
    comment text not null check (char_length(comment) between 1 and 1000),
    approved boolean not null default false,
    created_at timestamptz not null default now()
);

create table if not exists public.orders (
    order_id text primary key check (order_id ~ '^CMD-(?:[A-F0-9]{32}|[0-9]{4,})$'),
    customer jsonb not null check (jsonb_typeof(customer) = 'object'),
    products jsonb not null check (jsonb_typeof(products) = 'array'),
    subtotal numeric(12,2) not null check (subtotal >= 0),
    delivery_fee numeric(12,2) not null check (delivery_fee >= 0),
    total numeric(12,2) not null check (total = subtotal + delivery_fee),
    payment_method text not null check (payment_method in ('WhatsApp', 'Paiement à la livraison')),
    status text not null default 'Nouvelle'
        check (status in ('Nouvelle', 'Confirmée', 'En préparation', 'Expédiée', 'Livrée', 'Annulée')),
    created_at timestamptz not null default now(),
    status_updated_at timestamptz
);

create index if not exists product_reviews_approved_created_idx
    on public.product_reviews (approved, created_at desc);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

create or replace function public.is_store_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
    select coalesce((auth.jwt() -> 'app_metadata' ->> 'store_role') = 'admin', false);
$$;

alter table public.storefront_data enable row level security;
alter table public.product_reviews enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Public can read storefront data" on public.storefront_data;
create policy "Public can read storefront data"
    on public.storefront_data for select to anon, authenticated
    using (key in ('products', 'categories', 'hero_slides', 'shop_settings'));
drop policy if exists "Store admins manage storefront data" on public.storefront_data;
create policy "Store admins manage storefront data"
    on public.storefront_data for all to authenticated
    using (public.is_store_admin())
    with check (public.is_store_admin());

drop policy if exists "Public can read approved reviews" on public.product_reviews;
create policy "Public can read approved reviews"
    on public.product_reviews for select to anon, authenticated
    using (approved or public.is_store_admin());
drop policy if exists "Customers can submit pending reviews" on public.product_reviews;
create policy "Customers can submit pending reviews"
    on public.product_reviews for insert to anon, authenticated
    with check (not approved);
drop policy if exists "Store admins manage reviews" on public.product_reviews;
create policy "Store admins manage reviews"
    on public.product_reviews for all to authenticated
    using (public.is_store_admin())
    with check (public.is_store_admin());

drop policy if exists "Store admins manage orders" on public.orders;
create policy "Store admins manage orders"
    on public.orders for all to authenticated
    using (public.is_store_admin())
    with check (public.is_store_admin());

grant select on public.storefront_data to anon, authenticated;
grant insert, update, delete on public.storefront_data to authenticated;
grant select, insert on public.product_reviews to anon;
grant select, insert, update, delete on public.product_reviews to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant execute on function public.is_store_admin() to anon, authenticated;

create or replace function public.track_order(p_order_id text, p_phone text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select pg_catalog.jsonb_build_object(
        'order_id', o.order_id,
        'created_at', o.created_at,
        'status', o.status,
        'products', o.products,
        'total', o.total
    )
    from public.orders as o
    where o.order_id = pg_catalog.upper(pg_catalog.btrim(p_order_id))
      and pg_catalog.regexp_replace(o.customer ->> 'phone', '[^0-9]', '', 'g')
          = pg_catalog.regexp_replace(p_phone, '[^0-9]', '', 'g')
    limit 1;
$$;
revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;

create or replace function public.place_order(
    p_order_id text,
    p_customer jsonb,
    p_products jsonb,
    p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_item jsonb;
    v_product jsonb;
    v_products jsonb := '[]'::jsonb;
    v_catalog jsonb;
    v_subtotal numeric(12,2) := 0;
    v_delivery_fee numeric(12,2);
    v_total numeric(12,2);
    v_quantity integer;
    v_order public.orders%rowtype;
begin
    if coalesce(p_order_id, '') !~ '^CMD-[A-F0-9]{32}$'
       or jsonb_typeof(p_customer) <> 'object'
       or jsonb_typeof(p_products) <> 'array'
       or jsonb_array_length(p_products) < 1
       or jsonb_array_length(p_products) > 50
       or coalesce(p_payment_method, '') not in ('WhatsApp', 'Paiement à la livraison') then
        raise exception 'Informations de commande invalides';
    end if;

    if pg_catalog.length(pg_catalog.btrim(coalesce(p_customer ->> 'fullName', ''))) not between 1 and 120
       or pg_catalog.length(pg_catalog.regexp_replace(coalesce(p_customer ->> 'phone', ''), '[^0-9]', '', 'g')) not between 8 and 15
       or pg_catalog.length(pg_catalog.btrim(coalesce(p_customer ->> 'city', ''))) not between 1 and 100
       or pg_catalog.length(pg_catalog.btrim(coalesce(p_customer ->> 'address', ''))) not between 1 and 500
       or pg_catalog.length(coalesce(p_customer ->> 'notes', '')) > 1000 then
        raise exception 'Coordonnées client invalides';
    end if;

    select value into v_catalog
    from public.storefront_data
    where key = 'products';
    if v_catalog is null then raise exception 'Le catalogue est indisponible'; end if;

    for v_item in select value from pg_catalog.jsonb_array_elements(p_products)
    loop
        begin
            v_quantity := (v_item ->> 'quantity')::integer;
        exception when others then
            raise exception 'Quantité de produit invalide';
        end;
        if v_quantity < 1 or v_quantity > 99 then raise exception 'Quantité de produit invalide'; end if;

        select item into v_product
        from pg_catalog.jsonb_array_elements(v_catalog) as catalog(item)
        where item ->> 'id' = v_item ->> 'productId'
          and coalesce(item ->> 'active', 'true') <> 'false'
          and coalesce((item ->> 'available')::boolean, coalesce((item ->> 'stock')::integer, 0) > 0);

        if v_product is null then raise exception 'Un produit est indisponible'; end if;

        v_subtotal := v_subtotal + ((v_product ->> 'price')::numeric * v_quantity);
        v_products := v_products || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
            'productId', v_product ->> 'id',
            'name', v_product ->> 'name',
            'price', (v_product ->> 'price')::numeric,
            'quantity', v_quantity,
            'image', coalesce(v_product ->> 'image', '')
        ));
        v_product := null;
    end loop;

    v_delivery_fee := case when v_subtotal >= 300 then 0 else 30 end;
    v_total := v_subtotal + v_delivery_fee;

    insert into public.orders (
        order_id, customer, products, subtotal, delivery_fee, total, payment_method, status
    ) values (
        p_order_id, p_customer, v_products, v_subtotal, v_delivery_fee, v_total, p_payment_method, 'Nouvelle'
    )
    returning * into v_order;

    return pg_catalog.jsonb_build_object(
        'order_id', v_order.order_id,
        'customer', v_order.customer,
        'products', v_order.products,
        'subtotal', v_order.subtotal,
        'delivery_fee', v_order.delivery_fee,
        'total', v_order.total,
        'payment_method', v_order.payment_method,
        'status', v_order.status,
        'created_at', v_order.created_at
    );
end;
$$;
revoke all on function public.place_order(text, jsonb, jsonb, text) from public;
grant execute on function public.place_order(text, jsonb, jsonb, text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-assets', 'store-assets', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view store assets" on storage.objects;
create policy "Public can view store assets"
    on storage.objects for select to anon, authenticated
    using (bucket_id = 'store-assets');
drop policy if exists "Store admins upload assets" on storage.objects;
create policy "Store admins upload assets"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'store-assets' and public.is_store_admin());
drop policy if exists "Store admins update assets" on storage.objects;
create policy "Store admins update assets"
    on storage.objects for update to authenticated
    using (bucket_id = 'store-assets' and public.is_store_admin())
    with check (bucket_id = 'store-assets' and public.is_store_admin());
drop policy if exists "Store admins delete assets" on storage.objects;
create policy "Store admins delete assets"
    on storage.objects for delete to authenticated
    using (bucket_id = 'store-assets' and public.is_store_admin());

-- Create the owner user in Supabase Authentication first, then replace the
-- email below and run this once to give that user the store-admin role:
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"store_role":"admin"}'::jsonb
-- where email = 'owner@example.com';
