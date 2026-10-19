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
    // App kill hone par incoming call ka FCM push tap karne par yahan aata hai.
    // agora token yahan nahi hota (sirf accept response mein milta) — InCallScreen
    // khud accept karke token lega (callHelpers.acceptCall).
    call: {
        screen:    'InCall',
        getParams: (d) => ({ callId: d.entityId, type: d.callType, isIncoming: true }),
    },
    // Plan expiry reminder (backend scheduler: entity 'plan', extra.action 'plan_expiry')
    plan: {
        screen:    'Plans',
        getParams: () => ({}),
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
