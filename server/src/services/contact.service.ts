import { ContactDocument, ContactModel } from "../models";
import { CanonicalMessage } from "../channels/types";

class ContactService {
  async upsertFromMessage(
    workspaceId: string,
    message: CanonicalMessage
  ): Promise<ContactDocument | null> {
    if (!message.externalSenderId) {
      return null;
    }

    const identity = {
      channel: message.channel,
      externalUserId: message.externalSenderId,
    };

    const existing = await ContactModel.findOne({
      workspaceId,
      channelIdentities: {
        $elemMatch: identity,
      },
    });

    const displayName =
      message.senderProfile?.displayName ?? message.contact?.name ?? "Unknown";
    const username = message.senderProfile?.username;
    const avatar = message.senderProfile?.avatar;
    const phone = message.contact?.phone;

    if (existing) {
      const identities = existing.channelIdentities.map((current) => {
        if (
          current.channel === identity.channel &&
          current.externalUserId === identity.externalUserId
        ) {
          return {
            ...current.toObject(),
            displayName: displayName || current.displayName,
            username: username || current.username,
            avatar: avatar || current.avatar,
          };
        }

        return current.toObject();
      });

      existing.set("channelIdentities", identities);
      if (displayName && existing.primaryName === "Unknown contact") {
        existing.primaryName = displayName;
      }
      if (phone && !existing.phones.includes(phone)) {
        existing.phones.push(phone);
      }
      await existing.save();
      return existing;
    }

    return ContactModel.create({
      workspaceId,
      channelIdentities: [
        {
          ...identity,
          displayName,
          username,
          avatar,
        },
      ],
      primaryName: displayName,
      phones: phone ? [phone] : [],
    });
  }

  async getById(id: string) {
    return ContactModel.findById(id);
  }
}

export const contactService = new ContactService();
