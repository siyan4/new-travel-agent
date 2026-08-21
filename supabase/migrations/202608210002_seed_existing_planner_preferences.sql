update public.user_travel_preference_settings
set
  travel_interests = array['Iconic landmarks','Food and markets']::text[],
  planning_priorities = array[
    'Save time on transfers',
    'See places unique to the destination',
    'Eat well',
    'Keep the plan reliable'
  ]::text[],
  updated_at = now()
where cardinality(travel_interests) = 0
  and cardinality(planning_priorities) = 0;
