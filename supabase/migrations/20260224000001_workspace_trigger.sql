-- Auto-create workspace when a new user signs up
-- Fires on insert into auth.users

create or replace function create_workspace_for_new_user()
returns trigger as $$
declare
  new_workspace_id uuid;
begin
  -- Create a workspace named after their email prefix
  insert into public.workspaces (name)
  values (split_part(new.email, '@', 1))
  returning id into new_workspace_id;

  -- Add the user as owner
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function create_workspace_for_new_user();
