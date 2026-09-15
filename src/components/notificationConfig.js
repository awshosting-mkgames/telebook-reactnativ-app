export const ENTITY_ROUTE_MAP = {
    chat: {
        screen:    'Chat',
        getParams: (d) => ({ chatId: d.entityId }),
    },
    order: {
        screen:    'OrderDetail',
        getParams: (d) => ({ orderId: d.entityId }),
    },
    payment: {
        screen:    'PaymentSummary',
        getParams: (d) => ({ paymentId: d.entityId }),
    },
    user: {
        screen:    'UserProfile',
        getParams: (d) => ({ userId: d.entityId }),
    },
    post: {
        screen:    'PostDetail',
        getParams: (d) => ({ postId: d.entityId }),
    },
    channel: {
        screen:    'Channeldetailscreen',
        getParams: (d) => ({ channelId: d.entityId }),
    },
    promo: {
        screen:    'PromoScreen',
        getParams: (d) => ({ promoId: d.entityId }),
    },
    default: {
        screen:    'HomeScreen',
        getParams: () => ({}),
    },
};

export function getRouteConfig(data) {
    const entity = data?.entity ?? 'default';
    return ENTITY_ROUTE_MAP[entity] ?? ENTITY_ROUTE_MAP['default'];
}
