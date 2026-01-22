import {
  normalizePhone,
  normalizePhoneForStorage,
  formatPhoneForDisplay,
  getPhoneWithCountryCode,
  getContactInfo,
  getProfilePictureWithReason,
  findLeadByPhone,
  findLeadByPhoneAndName,
} from '../../_shared/index.ts';
import type { SupabaseClientType, WAHAConfig, Lead } from '../types.ts';

/**
 * Find existing lead by phone (flexible search)
 */
export async function findLead(
  supabase: SupabaseClientType,
  phone: string,
  name?: string
): Promise<Lead | null> {
  // Primary search by phone
  let lead = await findLeadByPhone(supabase, phone);

  // Fallback: search by phone + name
  if (!lead && name) {
    console.log('[lead-processor] Lead not found by phone, trying phone + name...');
    lead = await findLeadByPhoneAndName(supabase, phone, name);
  }

  return lead;
}

/**
 * Update existing lead with new interaction data
 */
export async function updateExistingLead(
  supabase: SupabaseClientType,
  lead: Lead,
  senderName: string,
  isFromFacebookLid: boolean,
  originalLid: string | null,
  wahaConfig: WAHAConfig | null,
  senderPhone: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    last_interaction_at: new Date().toISOString(),
  };

  // Update WhatsApp name if received
  if (senderName) {
    updateData.whatsapp_name = senderName;

    // Update generic name to real name
    const isGenericName =
      lead.name.startsWith('Lead ') ||
      lead.name.includes('via anúncio') ||
      lead.name.includes('(via anúncio)');

    if (isGenericName) {
      updateData.name = senderName;
      console.log('[lead-processor] Updating generic name to:', senderName);
    }
  }

  // Update LID flag if now we have real phone
  if (lead.is_facebook_lid && !isFromFacebookLid) {
    updateData.is_facebook_lid = false;
    console.log('[lead-processor] Updating LID lead with real phone');
  }

  // Fetch avatar if not present
  if (!lead.avatar_url && wahaConfig) {
    const avatarData = await fetchAvatarForLead(
      wahaConfig,
      senderPhone,
      lead.country_code,
      isFromFacebookLid,
      originalLid,
      lead.original_lid
    );

    if (avatarData.url) {
      updateData.avatar_url = avatarData.url;
      console.log('[lead-processor] Avatar updated for existing lead');
    } else if (avatarData.shouldRetry) {
      // Schedule avatar retry
      await supabase.from('automation_queue').insert({
        event: 'avatar_retry',
        payload: {
          lead_id: lead.id,
          contact_id: avatarData.contactId,
          is_lid: avatarData.isLid,
          session: wahaConfig.sessionName,
          instance_id: wahaConfig.instanceId,
          attempt: 1,
          reason: avatarData.reason,
        },
      });
    }
  }

  // Fetch name via API if still generic
  if (!senderName && (lead.name.startsWith('Lead ') || lead.name.includes('via anúncio'))) {
    console.log('[lead-processor] Lead with generic name, trying to fetch real name...');
    if (wahaConfig) {
      const phoneWithCountry = getPhoneWithCountryCode(senderPhone, lead.country_code);
      const contactInfo = await getContactInfo(
        wahaConfig.baseUrl,
        wahaConfig.apiKey,
        wahaConfig.sessionName,
        phoneWithCountry
      );
      if (contactInfo.pushname || contactInfo.name) {
        const newName = contactInfo.name || contactInfo.pushname;
        updateData.whatsapp_name = contactInfo.pushname || contactInfo.name;
        updateData.name = newName;
        console.log('[lead-processor] Name updated via API:', newName);
      }
    }
  }

  await supabase.from('leads').update(updateData).eq('id', lead.id);
}

/**
 * Fetch avatar for lead (handles both LID and phone)
 */
async function fetchAvatarForLead(
  wahaConfig: WAHAConfig,
  senderPhone: string,
  countryCode: string | null | undefined,
  isFromFacebookLid: boolean,
  originalLid: string | null,
  existingOriginalLid: string | null | undefined
): Promise<{
  url: string | null;
  shouldRetry: boolean;
  contactId: string;
  isLid: boolean;
  reason?: string;
}> {
  let contactIdForAvatar: string;
  let isLidRequest = false;

  if (isFromFacebookLid && originalLid) {
    contactIdForAvatar = `${originalLid}@lid`;
    isLidRequest = true;
    console.log('[lead-processor] Fetching avatar via LID:', contactIdForAvatar);
  } else if (existingOriginalLid) {
    contactIdForAvatar = `${existingOriginalLid}@lid`;
    isLidRequest = true;
    console.log('[lead-processor] Fetching avatar via existing LID:', contactIdForAvatar);
  } else {
    contactIdForAvatar = getPhoneWithCountryCode(senderPhone, countryCode);
    console.log('[lead-processor] Fetching avatar via phone:', contactIdForAvatar);
  }

  const avatarResult = await getProfilePictureWithReason(
    wahaConfig.baseUrl,
    wahaConfig.apiKey,
    wahaConfig.sessionName,
    contactIdForAvatar,
    isLidRequest
  );

  if (avatarResult.url) {
    return {
      url: avatarResult.url,
      shouldRetry: false,
      contactId: contactIdForAvatar,
      isLid: isLidRequest,
    };
  }

  return {
    url: null,
    shouldRetry: true,
    contactId: contactIdForAvatar,
    isLid: isLidRequest,
    reason: avatarResult.reason,
  };
}

/**
 * Create new lead
 */
export async function createNewLead(
  supabase: SupabaseClientType,
  senderPhone: string,
  senderName: string,
  isFromFacebookLid: boolean,
  originalLid: string | null,
  wahaConfig: WAHAConfig | null,
  tenantId: string | null
): Promise<Lead | null> {
  console.log('[lead-processor] Creating new lead for:', senderPhone);

  // Get first funnel stage
  const { data: firstStage } = await supabase
    .from('funnel_stages')
    .select('id')
    .order('order', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Prepare lead name
  let leadName = senderName || `Lead ${formatPhoneForDisplay(senderPhone)}`;
  let internalNoteForLid: string | null = null;

  if (isFromFacebookLid) {
    if (senderName) {
      leadName = senderName;
    } else {
      leadName = `Lead Facebook ${originalLid?.slice(-6) || Date.now().toString().slice(-6)}`;
    }
    internalNoteForLid = `Numero Privado (Facebook Ads)\n\nEste contato veio de um anuncio Click-to-WhatsApp. O numero de telefone real ainda nao esta disponivel por questoes de privacidade do Facebook.\n\nLID: ${originalLid}\n\nO sistema tentara resolver o numero automaticamente. Enquanto isso, voce pode conversar normalmente com o cliente.`;
  }

  // Fetch avatar
  let avatarUrl: string | null = null;
  let shouldScheduleAvatarRetry = false;
  let avatarRetryData: {
    contact_id: string;
    is_lid: boolean;
    session: string;
    instance_id: string;
    reason?: string;
  } | null = null;

  if (wahaConfig) {
    const avatarData = await fetchAvatarForLead(
      wahaConfig,
      senderPhone,
      null,
      isFromFacebookLid,
      originalLid,
      null
    );

    if (avatarData.url) {
      avatarUrl = avatarData.url;
      console.log('[lead-processor] Avatar found for new lead');
    } else {
      shouldScheduleAvatarRetry = true;
      avatarRetryData = {
        contact_id: avatarData.contactId,
        is_lid: avatarData.isLid,
        session: wahaConfig.sessionName,
        instance_id: wahaConfig.instanceId,
        reason: avatarData.reason,
      };
      console.log('[lead-processor] Avatar not found, will schedule retry after creating lead');
    }
  }

  // Normalize phone
  const phoneData = normalizePhoneForStorage(senderPhone);
  console.log('[lead-processor] Normalizing phone:', senderPhone, '->', phoneData);

  // For LID leads, use LID as phone (ensures uniqueness)
  const phoneForDb = isFromFacebookLid ? `LID_${originalLid}` : phoneData.localNumber;

  // Upsert lead
  const { data: upsertedLead, error: upsertError } = await supabase
    .from('leads')
    .upsert(
      {
        name: leadName,
        phone: phoneForDb,
        country_code: isFromFacebookLid ? null : phoneData.countryCode,
        whatsapp_name: senderName || null,
        source: isFromFacebookLid ? 'facebook_ads' : 'whatsapp',
        temperature: 'warm',
        stage_id: firstStage?.id,
        status: 'active',
        last_interaction_at: new Date().toISOString(),
        is_facebook_lid: isFromFacebookLid,
        original_lid: originalLid,
        avatar_url: avatarUrl,
        tenant_id: tenantId,
        internal_notes: internalNoteForLid,
      },
      {
        onConflict: 'phone',
        ignoreDuplicates: false,
      }
    )
    .select('*')
    .single();

  if (upsertError) {
    console.error('[lead-processor] Error creating/upserting lead:', upsertError);

    // Handle conflict - try to find existing lead
    if (upsertError.code === '23505') {
      const conflictLead = await findLeadByPhone(supabase, senderPhone);
      if (conflictLead) {
        console.log('[lead-processor] Lead found after conflict:', conflictLead.id);
        return conflictLead;
      }
    }

    return null;
  }

  console.log('[lead-processor] Lead created/updated:', upsertedLead.id);

  // Schedule avatar retry if needed
  if (shouldScheduleAvatarRetry && avatarRetryData && upsertedLead.id) {
    console.log('[lead-processor] Scheduling avatar retry for new lead:', upsertedLead.id);
    await supabase.from('automation_queue').insert({
      event: 'avatar_retry',
      payload: {
        lead_id: upsertedLead.id,
        ...avatarRetryData,
        attempt: 1,
      },
    });
  }

  return upsertedLead;
}

/**
 * Find lead by LID (original_lid field)
 */
export async function findLeadByLid(
  supabase: SupabaseClientType,
  lid: string,
  tenantId: string | null
): Promise<Lead | null> {
  const lidNumber = lid.replace('@lid', '').replace(/\D/g, '');
  console.log('[lead-processor] Searching lead by original_lid:', lidNumber);

  let query = supabase
    .from('leads')
    .select('id, phone, name, country_code, original_lid, is_facebook_lid')
    .eq('original_lid', lidNumber);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data: existingLead, error } = await query.maybeSingle();

  if (error) {
    console.error('[lead-processor] Error searching lead by LID:', error);
    return null;
  }

  if (existingLead) {
    console.log(
      '[lead-processor] Lead found by original_lid:',
      existingLead.name,
      existingLead.phone
    );
    return existingLead as Lead;
  }

  return null;
}

/**
 * Get instance phone number
 */
export async function getInstancePhoneNumber(
  supabase: SupabaseClientType,
  instanceId: string
): Promise<string | null> {
  const { data: instanceData } = await supabase
    .from('whatsapp_config')
    .select('phone_number')
    .eq('id', instanceId)
    .maybeSingle();

  return instanceData?.phone_number || null;
}

/**
 * Get contact name via WAHA API
 */
export async function getContactNameFromAPI(
  wahaConfig: WAHAConfig,
  phone: string,
  countryCode: string | null | undefined
): Promise<string | null> {
  const phoneWithCountry = getPhoneWithCountryCode(phone, countryCode);
  console.log('[lead-processor] Fetching contact info for:', phoneWithCountry);

  const contactInfo = await getContactInfo(
    wahaConfig.baseUrl,
    wahaConfig.apiKey,
    wahaConfig.sessionName,
    phoneWithCountry
  );

  // Priority: saved contact name > WhatsApp pushname
  return contactInfo.name || contactInfo.pushname || null;
}
