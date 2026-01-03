-- Forçar user_id = auth.uid() em inserções no lead_history para auditoria completa
DROP POLICY IF EXISTS "Validated insert lead history" ON lead_history;

CREATE POLICY "Validated insert lead history" ON lead_history
FOR INSERT WITH CHECK (user_id = auth.uid());