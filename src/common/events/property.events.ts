import { eventBus } from '@/infra/eventbus';

export type PropertyCreatedEvent = {
  readonly event: 'property:created';
  readonly propertyId: string;
  readonly ownerId: string;
  readonly title: string;
};

export type PropertyUpdatedEvent = {
  readonly event: 'property:updated';
  readonly propertyId: string;
  readonly lastUpdatedBy: string;
};

export type AgentAuthorizedEvent = {
  readonly event: 'agent:authorized';
  readonly authId: string;
  readonly propertyId: string;
  readonly agentId: string;
  readonly ownerId: string;
  readonly commissionType: string;
  readonly commissionValue: number;
};

export class PropertyEventListeners {
  constructor() {
    eventBus.on('property:created', this.handlePropertyCreated);
    eventBus.on('property:updated', this.handlePropertyUpdated);
    eventBus.on('agent:authorized', this.handleAgentAuthorized);
  }

  private handlePropertyCreated(...args: unknown[]): void {
    const [, propertyId, ownerId, title] = args as [
      string,
      string,
      string,
      string,
    ];

    if (!propertyId || !ownerId) {
      return;
    }
  }

  private handlePropertyUpdated(...args: unknown[]): void {
    const [, propertyId, lastUpdatedBy] = args as [string, string, string];

    if (!propertyId) {
      return;
    }
  }

  private handleAgentAuthorized(...args: unknown[]): void {
    const [
      ,
      authId,
      propertyId,
      agentId,
      _ownerId,
      _commissionType,
      _commissionValue,
    ] = args as [string, string, string, string, string, string, number];

    if (!authId || !propertyId || !agentId) {
      return;
    }
  }
}
