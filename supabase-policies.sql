-- Enable RLS
alter table name_records enable row level security;

-- Create policy for inserting records (users can only insert their own records)
create policy "Users can insert their own records"
on name_records for insert
with check (auth.uid() = user_id);

-- Create policy for selecting records (users can only view their own records)
create policy "Users can view their own records"
on name_records for select
using (auth.uid() = user_id);

-- Create policy for updating records (users can only update their own records)
create policy "Users can update their own records"
on name_records for update
using (auth.uid() = user_id);

-- Create policy for deleting records (users can only delete their own records)
create policy "Users can delete their own records"
on name_records for delete
using (auth.uid() = user_id); 