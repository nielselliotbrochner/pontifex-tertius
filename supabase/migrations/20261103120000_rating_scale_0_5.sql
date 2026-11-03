-- Rating går fra 0 til 5 (0 = kan ikke, 5 = stærkest). null = vurderet uden svar. Ingen række = ikke vurderet.
alter table public.company_rating drop constraint company_rating_value_check;
alter table public.company_rating add constraint company_rating_value_check check (value between 0 and 5);
