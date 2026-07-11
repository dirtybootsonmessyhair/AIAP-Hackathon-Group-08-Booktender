-- Booktender complete product: metadata, safe seeds and account bootstrap.
alter table public.books add column if not exists cover_url text;
alter table public.books add column if not exists source_url text;
alter table public.books add column if not exists buy_url text;
alter table public.books add column if not exists community_count integer not null default 0;
alter table public.reading_content add column if not exists content_type text not null default 'book_bite';
alter table public.saved_quotes add column if not exists author text;
alter table public.saved_quotes add column if not exists source text;

create table if not exists public.community_challenges (
  id uuid primary key default gen_random_uuid(), community_id uuid references public.communities on delete cascade,
  title text not null, target_value integer not null, current_value integer not null default 0,
  metric text not null default 'pages', start_date date, end_date date
);
alter table public.community_challenges enable row level security;
create policy "public challenges read" on public.community_challenges for select using (true);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Reader'))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

insert into public.books (id,title,author,genres,mood_tags,description,reading_minutes,public_domain,content_type,cover_url,source_url,buy_url,community_count) values
('frankenstein','Frankenstein','Mary Shelley',array['Classic','Gothic'],array['Reflective','Adventurous'],'A haunting classic about ambition, responsibility and belonging.',55,true,'public_domain','https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg','https://www.gutenberg.org/ebooks/84',null,482),
('pride','Pride and Prejudice','Jane Austen',array['Classic','Romance'],array['Cozy','Hopeful'],'A witty, warm social comedy with a celebrated slow-burn romance.',50,true,'public_domain','https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg','https://www.gutenberg.org/ebooks/1342',null,691),
('jane-eyre','Jane Eyre','Charlotte Brontë',array['Classic','Coming of age'],array['Reflective','Hopeful'],'An intimate story of independence, courage and finding a voice.',65,true,'public_domain','https://www.gutenberg.org/cache/epub/1260/pg1260.cover.medium.jpg','https://www.gutenberg.org/ebooks/1260',null,355),
('alice','Alice''s Adventures in Wonderland','Lewis Carroll',array['Classic','Fantasy'],array['Adventurous','Cozy'],'A playful, strange and quick journey through curious logic.',35,true,'public_domain','https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg','https://www.gutenberg.org/ebooks/11',null,274),
('secret-garden','The Secret Garden','Frances Hodgson Burnett',array['Classic','Feel-good'],array['Hopeful','Cozy'],'A restorative story about friendship and renewal.',45,true,'public_domain','https://www.gutenberg.org/cache/epub/17396/pg17396.cover.medium.jpg','https://www.gutenberg.org/ebooks/17396',null,519),
('walden','Walden','Henry David Thoreau',array['Classic','Philosophy'],array['Focused','Reflective'],'A thoughtful invitation to simplify and live deliberately.',40,true,'public_domain','https://www.gutenberg.org/cache/epub/205/pg205.cover.medium.jpg','https://www.gutenberg.org/ebooks/205',null,198),
('atomic-habits','Atomic Habits','James Clear',array['Non-fiction','Self growth'],array['Focused','Hopeful'],'A practical modern guide to repeatable small actions.',40,false,'book_bite',null,'https://jamesclear.com/atomic-habits','https://www.amazon.in/s?k=Atomic+Habits+James+Clear',812),
('kite-runner','The Kite Runner','Khaled Hosseini',array['Literary fiction','Contemporary'],array['Reflective','Hopeful'],'An emotionally rich novel about friendship and redemption.',60,false,'book_bite',null,'https://www.amazon.in/s?k=The+Kite+Runner+Khaled+Hosseini','https://www.amazon.in/s?k=The+Kite+Runner+Khaled+Hosseini',733),
('alchemist','The Alchemist','Paulo Coelho',array['Fiction','Fable'],array['Hopeful','Adventurous'],'A short reflective fable about purpose and risk.',35,false,'book_bite',null,'https://www.amazon.in/s?k=The+Alchemist+Paulo+Coelho','https://www.amazon.in/s?k=The+Alchemist+Paulo+Coelho',945)
on conflict (id) do update set title=excluded.title,author=excluded.author,genres=excluded.genres,mood_tags=excluded.mood_tags,description=excluded.description,reading_minutes=excluded.reading_minutes,public_domain=excluded.public_domain,content_type=excluded.content_type,cover_url=excluded.cover_url,source_url=excluded.source_url,buy_url=excluded.buy_url,community_count=excluded.community_count;

insert into public.communities (name,description,next_event_at) select 'The Sunday Shelf','A spoiler-light reading community for thoughtful next chapters.', now() + interval '5 days' where not exists (select 1 from public.communities where name='The Sunday Shelf');
insert into public.community_challenges (community_id,title,target_value,current_value,metric,start_date,end_date) select id,'Together, read 2,000 pages this week',2000,1462,'pages',current_date,current_date+7 from public.communities where name='The Sunday Shelf' and not exists (select 1 from public.community_challenges);
