-- MIGRAÇÃO 2: Sincronizar Etiquetas do N8N e atualizar trigger

-- Remover duplicatas conhecidas (manter apenas uma)
DELETE FROM labels WHERE name = 'Google Ads' AND id != (SELECT id FROM labels WHERE name = 'Google Ads' ORDER BY created_at LIMIT 1);
DELETE FROM labels WHERE name = 'Reativação' AND id != (SELECT id FROM labels WHERE name = 'Reativação' ORDER BY created_at LIMIT 1);

-- ===== STATUS (workflow) =====
INSERT INTO labels (id, name, color, category) VALUES
  ('218c0fb3-d136-426c-bd29-6fe1227cfd42', '🤖 Atendimento IA', '#6366F1', 'status'),
  ('f9ff4350-e3b4-4865-8cc3-b864b25d8b65', '🔥 RESPONDER', '#EF4444', 'status'),
  ('1b6c1ee8-f24f-4bb9-9b5b-78e7d614c246', '🔥 CASO QUENTE!', '#DC2626', 'status'),
  ('3da05282-d5b1-4e62-b2e8-8b880af0416f', '📅 Agendar Reunião', '#F59E0B', 'status'),
  ('467419f2-1446-4d5f-a2f7-5bd486203fa2', '1️⃣Chamar novamente', '#8B5CF6', 'status'),
  ('551773d8-4c90-4915-b2b6-13d3d4d389d1', '2️⃣Chamar novamente', '#8B5CF6', 'status'),
  ('65da801e-37e0-46a4-9a27-891676616076', '3️⃣Chamar novamente', '#8B5CF6', 'status'),
  ('7305bdba-51ea-47fa-9004-78b3b06f948b', '4️⃣Chamar novamente', '#8B5CF6', 'status'),
  ('4161774c-03ae-4371-9fc5-f64ec7e4c70f', '5️⃣Chamar novamente', '#8B5CF6', 'status'),
  ('15ef5c10-457f-43cd-b2e6-6019da8c2b36', '7️⃣Chamar novamente', '#8B5CF6', 'status'),
  ('73452b13-b9f4-4f41-a48f-6b3fc9484032', '❌ SEM DIREITO', '#6B7280', 'status'),
  ('757daff2-36fe-4655-a221-7bd6a0007dc2', 'Lead Ruim 🗑️', '#374151', 'status')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  category = EXCLUDED.category;

-- ===== BENEFÍCIO (produto) =====
INSERT INTO labels (id, name, color, category) VALUES
  ('638a244c-9e61-4276-916a-add22df0a8a2', '♿️ BPC - Deficiência', '#3B82F6', 'beneficio'),
  ('1ecfc5b2-f189-4116-a8c5-2ee154a4594e', '👴🏼 BPC - Idoso', '#10B981', 'beneficio'),
  ('55a1d9cb-6c87-4885-b0a8-34a1a0855675', '🧩 BPC - Autista', '#8B5CF6', 'beneficio'),
  ('9a7280db-b287-4c37-9dd2-89a7cc9384c9', '👩‍👧‍👦 Mãe de Autista', '#EC4899', 'beneficio'),
  ('6f852551-070a-495a-b52e-b8e486fde967', '🤕 Ben. Incapacidade', '#F97316', 'beneficio'),
  ('9af12027-8b51-4ace-a582-ef8b8ed590ce', '🩼 Aux. Acidente', '#EAB308', 'beneficio'),
  ('4a6f6904-3b4a-40af-852d-434c2f694913', '👵🏼 Ap. Idade', '#14B8A6', 'beneficio'),
  ('4ea6dc02-66d9-4c5a-ad65-c3508265a4bd', '👵🏼 Ap. Invalidez', '#06B6D4', 'beneficio'),
  ('50af9bef-bcbb-4de7-acb0-e6b5857b66d9', '👵🏼 Ap. por contribuição', '#0EA5E9', 'beneficio'),
  ('b9b50305-9a03-48f9-8ec0-f416e69237e5', '🚜 Ap. Rural', '#84CC16', 'beneficio'),
  ('d38b2b65-be4a-472a-b572-fa991679f40e', '☢️ Ap. Especial', '#F43F5E', 'beneficio'),
  ('13fdf99d-348d-4357-943c-88e71202bbf3', '⚰ Pensão por morte', '#64748B', 'beneficio'),
  ('bb80e3a8-3e5f-4588-b065-5a0cc037a4e0', '🤰Salário Maternidade', '#F472B6', 'beneficio'),
  ('dd05690f-9d04-4396-bcc6-1253b7faabc3', '🔒 Auxílio Reclusão', '#78716C', 'beneficio'),
  ('07527c7a-caf6-48b2-88bf-5cf423feae1d', 'Revisão de Aposentadoria', '#A3A3A3', 'beneficio'),
  ('b3e4e9dc-7969-43f8-a25b-2d2dd3a4ae49', 'Revisão do Benefício', '#A3A3A3', 'beneficio'),
  ('aa1e8509-e7f6-4f9f-9a7c-edbfe26b9bfb', 'Prorrogação de Benefício', '#A3A3A3', 'beneficio'),
  ('998e70e7-3c73-42bd-8662-4d91cce3f520', '📝 Planejamento Previdenciário', '#6366F1', 'beneficio')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  category = EXCLUDED.category;

-- ===== SITUAÇÃO =====
INSERT INTO labels (id, name, color, category) VALUES
  ('9ef95580-0710-43d9-aeeb-9a62af8de3b7', '📄 SEM LAUDO', '#F59E0B', 'situacao'),
  ('68623fbd-0cae-472f-b343-b428565f764d', '🩺 Aguardando Laudo Novo', '#F97316', 'situacao'),
  ('64ad85d5-1759-4268-9295-b2345e4b2663', '💰 Renda Incompatível BPC', '#EF4444', 'situacao'),
  ('c77f32ae-a4ab-4c4d-adf4-f5ea7c9a9604', '🕒 Sem Tempo Contribuição', '#6B7280', 'situacao'),
  ('72fbc31c-11c3-4c59-abcc-7c7aa757aabf', 'Sem Idade', '#6B7280', 'situacao'),
  ('ae9dc548-331f-4b04-80df-9c41ad2b57d8', '🏢 Tem MEI - Incompatível', '#DC2626', 'situacao'),
  ('8438aa6c-7e7b-47b2-958e-a548565475e4', 'Não tem condição de segurado', '#6B7280', 'situacao'),
  ('04027b57-aba7-4930-af36-cabae96d351d', '✖ Não tem documentos', '#EF4444', 'situacao'),
  ('159b78a7-120e-4e3a-ae9d-e8b6b98b0361', 'Deu entrada sozinha', '#A3A3A3', 'situacao'),
  ('3453cd4f-14ea-484e-8ab9-0a9ff770ae93', 'Já recebe do INSS', '#10B981', 'situacao'),
  ('889f727d-77f4-4bf8-831a-4d439d3425a7', 'Já é aposentado', '#10B981', 'situacao'),
  ('b380a0b6-92f7-45c0-a451-13bb1e5ce856', 'Servidor Público', '#3B82F6', 'situacao'),
  ('ff7bc8dd-b049-4580-9acf-996827e64082', 'Previdência Privada', '#8B5CF6', 'situacao'),
  ('05b04fd1-8190-4c76-bd0b-aef435d742b8', '🗣️ Indicou Alguém', '#22C55E', 'situacao')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  category = EXCLUDED.category;

-- ===== PERDA =====
INSERT INTO labels (id, name, color, category) VALUES
  ('3c91f30d-06df-421a-83a5-0aea4e5a2f27', '✖ Não fechou por ser online', '#EF4444', 'perda'),
  ('4ddc2273-d976-4f63-aac5-eef1a7b11334', '✖ Não quer marcar horário', '#EF4444', 'perda'),
  ('cf22ff1e-6aad-48c2-83cd-1a5000e68495', '✖ Quer tirar dúvida', '#F59E0B', 'perda'),
  ('95349949-7d15-49b0-b322-3e9a4d378508', '💵 Não gostou de como cobramos', '#DC2626', 'perda'),
  ('1f10ff4c-39ea-40f6-9465-d59bf0d0d250', 'Cliente Doido', '#374151', 'perda'),
  ('a24e668a-fea2-43ec-a842-9a71ddacc9af', 'Não sabe ler', '#6B7280', 'perda')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  category = EXCLUDED.category;

-- ===== Atualizar Trigger dispatch_webhook_event =====
CREATE OR REPLACE FUNCTION public.dispatch_webhook_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  webhook_event text;
  payload jsonb;
  label_name text;
  label_color text;
  label_cat text;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'leads' THEN
      CASE TG_OP
        WHEN 'INSERT' THEN
          webhook_event := 'lead.created';
          payload := jsonb_build_object(
            'event', webhook_event,
            'timestamp', now(),
            'data', jsonb_build_object('lead', row_to_json(NEW))
          );
        WHEN 'UPDATE' THEN
          IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
            webhook_event := 'lead.stage_changed';
            payload := jsonb_build_object(
              'event', webhook_event,
              'timestamp', now(),
              'data', jsonb_build_object(
                'lead', row_to_json(NEW),
                'previous_stage_id', OLD.stage_id,
                'new_stage_id', NEW.stage_id
              )
            );
          ELSIF OLD.temperature IS DISTINCT FROM NEW.temperature THEN
            webhook_event := 'lead.temperature_changed';
            payload := jsonb_build_object(
              'event', webhook_event,
              'timestamp', now(),
              'data', jsonb_build_object(
                'lead', row_to_json(NEW),
                'previous_temperature', OLD.temperature,
                'new_temperature', NEW.temperature
              )
            );
          ELSIF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
            webhook_event := 'lead.assigned';
            payload := jsonb_build_object(
              'event', webhook_event,
              'timestamp', now(),
              'data', jsonb_build_object(
                'lead', row_to_json(NEW),
                'previous_assigned_to', OLD.assigned_to,
                'new_assigned_to', NEW.assigned_to
              )
            );
          ELSE
            webhook_event := 'lead.updated';
            payload := jsonb_build_object(
              'event', webhook_event,
              'timestamp', now(),
              'data', jsonb_build_object('lead', row_to_json(NEW))
            );
          END IF;
        WHEN 'DELETE' THEN
          webhook_event := 'lead.deleted';
          payload := jsonb_build_object(
            'event', webhook_event,
            'timestamp', now(),
            'data', jsonb_build_object('lead', row_to_json(OLD))
          );
      END CASE;
      
    WHEN 'messages' THEN
      IF TG_OP = 'INSERT' THEN
        IF NEW.sender_type = 'lead' THEN
          webhook_event := 'message.received';
        ELSE
          webhook_event := 'message.sent';
        END IF;
        payload := jsonb_build_object(
          'event', webhook_event,
          'timestamp', now(),
          'data', jsonb_build_object('message', row_to_json(NEW))
        );
      END IF;
      
    WHEN 'conversations' THEN
      CASE TG_OP
        WHEN 'INSERT' THEN
          webhook_event := 'conversation.created';
          payload := jsonb_build_object(
            'event', webhook_event,
            'timestamp', now(),
            'data', jsonb_build_object('conversation', row_to_json(NEW))
          );
        WHEN 'UPDATE' THEN
          IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
            webhook_event := 'conversation.assigned';
            payload := jsonb_build_object(
              'event', webhook_event,
              'timestamp', now(),
              'data', jsonb_build_object(
                'conversation', row_to_json(NEW),
                'previous_assigned_to', OLD.assigned_to,
                'new_assigned_to', NEW.assigned_to
              )
            );
          ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'resolved' THEN
            webhook_event := 'conversation.resolved';
            payload := jsonb_build_object(
              'event', webhook_event,
              'timestamp', now(),
              'data', jsonb_build_object('conversation', row_to_json(NEW))
            );
          ELSE
            RETURN COALESCE(NEW, OLD);
          END IF;
      END CASE;
      
    WHEN 'tasks' THEN
      CASE TG_OP
        WHEN 'INSERT' THEN
          webhook_event := 'task.created';
          payload := jsonb_build_object(
            'event', webhook_event,
            'timestamp', now(),
            'data', jsonb_build_object('task', row_to_json(NEW))
          );
        WHEN 'UPDATE' THEN
          IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'done' THEN
            webhook_event := 'task.completed';
            payload := jsonb_build_object(
              'event', webhook_event,
              'timestamp', now(),
              'data', jsonb_build_object('task', row_to_json(NEW))
            );
          ELSE
            RETURN COALESCE(NEW, OLD);
          END IF;
      END CASE;
      
    WHEN 'lead_labels' THEN
      CASE TG_OP
        WHEN 'INSERT' THEN
          webhook_event := 'lead.label_added';
          SELECT name, color, category::text INTO label_name, label_color, label_cat
          FROM public.labels WHERE id = NEW.label_id;
          
          payload := jsonb_build_object(
            'event', webhook_event,
            'timestamp', now(),
            'data', jsonb_build_object(
              'lead_id', NEW.lead_id,
              'label_id', NEW.label_id,
              'label_name', label_name,
              'label_color', label_color,
              'label_category', label_cat
            )
          );
        WHEN 'DELETE' THEN
          webhook_event := 'lead.label_removed';
          SELECT name, color, category::text INTO label_name, label_color, label_cat
          FROM public.labels WHERE id = OLD.label_id;
          
          payload := jsonb_build_object(
            'event', webhook_event,
            'timestamp', now(),
            'data', jsonb_build_object(
              'lead_id', OLD.lead_id,
              'label_id', OLD.label_id,
              'label_name', label_name,
              'label_color', label_color,
              'label_category', label_cat
            )
          );
      END CASE;
      
    ELSE
      RETURN COALESCE(NEW, OLD);
  END CASE;
  
  IF webhook_event IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  INSERT INTO public.webhook_queue (event, payload)
  VALUES (webhook_event::webhook_event, payload);
  
  INSERT INTO public.automation_queue (event, payload)
  VALUES (webhook_event, payload);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;