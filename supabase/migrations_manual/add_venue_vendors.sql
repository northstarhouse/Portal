-- The recommended vendor list shown in every client guide (venue.northstarhouse.org/guidebook), kept here so the venue team can add
-- recommendations from Venue Rentals > Tools and have them show up in the guides right away.
-- Anyone can read the active vendors (the guides are public); only a signed-in Portal session can add, change or remove them.
create table if not exists public.venue_vendors (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  category_order int not null default 100,
  name text not null,
  website text,
  phone text,
  instagram text,
  email text,
  sort_order int not null default 100,
  active boolean not null default true,
  added_by text,
  created_at timestamptz not null default now()
);
alter table public.venue_vendors enable row level security;
drop policy if exists venue_vendors_read on public.venue_vendors;
create policy venue_vendors_read on public.venue_vendors for select using (active or has_valid_app_session());
drop policy if exists venue_vendors_insert on public.venue_vendors;
create policy venue_vendors_insert on public.venue_vendors for insert with check (has_valid_app_session());
drop policy if exists venue_vendors_update on public.venue_vendors;
create policy venue_vendors_update on public.venue_vendors for update using (has_valid_app_session()) with check (has_valid_app_session());

-- The list as it stood in the guide (only loaded once, while the table is empty).
do $seed$ begin if not exists (select 1 from public.venue_vendors) then
insert into public.venue_vendors (category, category_order, name, website, phone, instagram, sort_order) values
('Caterers', 1, 'Antonio Ayestaran Custom Catering', 'https://antoniocatering.net', '530-401-8462', null, 1),
('Caterers', 1, 'Farm to Table Catering', 'https://farm2tablecatering.com', '530-615-7707', null, 2),
('Caterers', 1, 'The Ham Stand', 'https://thehamstand.com', '530-264-7685', null, 3),
('Caterers', 1, 'Bella Familia Pizza / Gourmet Garage', 'https://gourmetgarageloomis.com', '530-448-6358', null, 4),
('Caterers', 1, 'Savor the Flavor BBQ', 'https://savortheflavorbbq.com', '530-748-9285', null, 5),
('DJ Services', 2, 'AVL Entertainment', 'https://avlentertainment.com', null, '@avlentertainment', 1),
('DJ Services', 2, 'Someone Said Yes', 'https://someonesaidyes.com', null, '@someonesaidyes', 2),
('DJ Services', 2, 'A Serious Production', 'https://aseriousproduction.com', null, '@aseriousproduction', 3),
('DJ Services', 2, 'All Star DJ', 'https://allstardjgroup.com', null, '@allstardjgroup', 4),
('DJ Services', 2, 'The Music Xpress', 'https://themusicxpressdj.com', null, '@themusicxpress', 5),
('Photographers', 3, 'Bryan Gallagher Photo', 'https://bryangallagherphoto.com', null, '@bryangallagherphoto', 1),
('Photographers', 3, 'Andrew & Melanie Photography', 'https://andrewandmelanie.com', null, '@andrewmelaniephoto', 2),
('Photographers', 3, 'Kathryn White Photography', 'https://kathrynwhitephotography.com', null, '@kathrynwhitephoto', 3),
('Photographers', 3, 'Ari Christine Photography', 'https://arichristine.biz', null, '@arichristinephoto', 4),
('Photographers', 3, 'Savv Productions', 'https://savvproductions.com', null, '@savvproductions', 5),
('Party Rental Services', 4, 'SRC Rentals', 'https://srcparty.com', '530-272-2266', null, 1),
('Party Rental Services', 4, 'Timeless Arches', 'https://timelessarches.com', '775-800-6190', null, 2),
('Party Rental Services', 4, 'Sutter Tents', 'https://suttertents.com', '530-645-2002', null, 3),
('Florists', 5, 'Golden Flowers', 'https://goldenflorals.com', '530-557-7689', null, 1),
('Florists', 5, 'LaFleur Flower Studio', 'https://flowers-studio-lafleur.com', '916-500-3859', null, 2),
('Florists', 5, 'Sweet Roots Floral', 'https://sweetrootsfarm.com', '530-277-0338', null, 3),
('Florists', 5, 'Grass Valley Florist', 'https://grassvalleyflorist.com', '530-273-2223', null, 4),
('Florists', 5, 'Pretty in Petals', 'https://prettyinpetalsnc.com', '209-661-0251', null, 5),
('Cakes & Desserts', 6, 'I Do’s by Deb', 'https://idosbydeb.com', '530-409-3716', null, 1),
('Cakes & Desserts', 6, 'Cake Bakery & Cafe', 'https://grassvalleybakery.com', '530-615-4126', null, 2),
('Cakes & Desserts', 6, 'The Sweet Spot', 'https://thesweetspotgv.com', '530-920-0462', null, 3),
('Cakes & Desserts', 6, 'Corvus Bakery', 'https://corvusbakery.com', '530-802-5102', null, 4),
('Cakes & Desserts', 6, 'Sweet Tooth Baking Company', 'https://sweettoothbakingco.com', null, null, 5),
('Event Planners', 7, 'Wild & Lovely Events', 'https://wildandlovelyevents.com', '530-913-3735', null, 1),
('Event Planners', 7, 'A Curated Story', 'https://acuratedstory.com', '530-913-8527', null, 2),
('Event Planners', 7, 'The Fairy God Coordinator', 'https://fairygodcoordinator.com', '916-561-9525', null, 3),
('Event Planners', 7, 'To Have & To Hold Wedding Planning', 'https://tohaveandtoholdweddings.com', '925-408-7888', null, 4),
('Event Planners', 7, 'Your Day with Caylie J', 'https://yourdaywithcayliej.biz', '530-304-8008', null, 5),
('Event Planners', 7, 'Storybook Weddings', 'https://storybookweddings.biz', '530-320-8882', null, 6),
('Event Planners', 7, 'Honeysuckle Traditions', 'https://honeysuckletraditions.com', '540-671-6551', null, 7),
('Beverage Services', 8, 'Tap Truck Sierra Foothills', 'https://taptrucksierrafoothills.com', '530-906-0030', null, 1),
('Beverage Services', 8, 'Tumbleweed Tavern', 'https://tumbleweedtaverngv.com', '530-362-0932', null, 2),
('Beauty', 9, 'Carrie L’esperance', 'https://carrielesperance.com', '530-615-9736', null, 1),
('Beauty', 9, 'Wanderlust Beauty Collective', 'https://wanderlustbeautynorcal.com', null, null, 2),
('Beauty', 9, 'Courtney Sage', 'https://courtneysagemakeup.com', null, null, 3),
('Beauty', 9, 'Luxe Esthetics by Maddie', 'https://luxeestheticsbymaddie.com', '530-913-2905', null, 4),
('Officiants', 10, 'Legacies of Love', 'https://legaciesmadeoflove.com', '530-545-9405', null, 1),
('Officiants', 10, 'Pastor Mark', 'https://weddingpastorcalifornia.com', '530-207-0880', null, 2),
('Accommodations', 11, 'Gold Miners Inn', 'https://goldminersinn.com', '530-477-1700', null, 1),
('Accommodations', 11, 'Creektown Cottages', 'https://creektowncottages.com', '530-308-2370', null, 2),
('Accommodations', 11, 'Inn Town Campground', 'https://inntowncampground.com', '530-265-9900', null, 3),
('Accommodations', 11, 'Holbrooke Hotel', 'https://holbrooke.com', '530-273-1353', null, 4),
('Accommodations', 11, 'The Parsonage 1865', 'https://theparsonage1865.com', '530-798-6061', null, 5),
('Accommodations', 11, 'Courtyard Suites', 'https://gvcourtyardsuites.com', null, null, 6),
('Shuttle Services', 12, 'Regal Carriage and Limo', 'https://regalcarriagesacramento.com', '916-956-8507', null, 1),
('Shuttle Services', 12, 'Fretty’s', 'https://frettys.com', '530-273-2296', null, 2),
('Portable Restrooms', 13, 'Executive Washrooms', 'https://executive-washrooms.com', '530-933-8503', null, 1),
('Portable Restrooms', 13, 'Moonlight LOO', 'https://moonlightloo.com', '530-265-2253', null, 2),
('Novelties', 14, 'Stick With Me – Custom Illustrations & Design', 'https://stickwithmeillustrations.com', null, null, 1),
('Novelties', 14, 'Queen of Hearts Mobile Tattoo', null, '530-923-3846', null, 2),
('Novelties', 14, 'Linked Gems', 'https://linked-gems.square.site', null, null, 3);
end if; end $seed$;
