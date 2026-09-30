import {
  createSdkworkOrderMessages,
  type SdkworkOrderMessagesOverrides,
} from "./order-copy";
import {
  createSdkworkOrderService,
  type SdkworkOrderLogistics,
  type SdkworkOrderService,
} from "./order-service";

export interface SdkworkLogisticsControllerState {
  isBootstrapped: boolean;
  isLoading: boolean;
  lastError?: string;
  logistics: SdkworkOrderLogistics;
}

export interface SdkworkLogisticsController {
  bootstrap(input: { orderId?: string; shipmentId?: string }): Promise<SdkworkLogisticsControllerState>;
  getState(): SdkworkLogisticsControllerState;
  subscribe(listener: () => void): () => void;
}

export interface CreateSdkworkLogisticsControllerOptions {
  locale?: string | null;
  messages?: SdkworkOrderMessagesOverrides;
  service?: SdkworkOrderService;
}

export function createSdkworkLogisticsController(
  options: CreateSdkworkLogisticsControllerOptions = {},
): SdkworkLogisticsController {
  const service = options.service ?? createSdkworkOrderService({
    locale: options.locale,
    messages: options.messages,
  });
  const listeners = new Set<() => void>();
  let state: SdkworkLogisticsControllerState = {
    isBootstrapped: false,
    isLoading: false,
    logistics: { shipments: [] },
  };

  function emit(): void {
    listeners.forEach((listener) => listener());
  }

  function setState(partial: Partial<SdkworkLogisticsControllerState>): void {
    state = { ...state, ...partial };
    emit();
  }

  return {
    async bootstrap(input) {
      setState({
        isLoading: true,
        lastError: undefined,
      });

      try {
        const logistics = await service.getOrderLogistics(input);
        setState({
          isBootstrapped: true,
          isLoading: false,
          logistics,
        });
        return state;
      } catch (error) {
        setState({
          isBootstrapped: true,
          isLoading: false,
          lastError: error instanceof Error ? error.message : undefined,
        });
        return state;
      }
    },

    getState() {
      return state;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
