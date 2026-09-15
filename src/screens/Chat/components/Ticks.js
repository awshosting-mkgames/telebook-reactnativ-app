import React from 'react';
import { Ionicons } from '@expo/vector-icons';

// WhatsApp tick logic:
//  🕐  sending   → clock (grey)
//  ✓   sent      → single tick (grey)    — server ne receive kiya
//  ✓✓  delivered → double tick (grey)    — device ne receive kiya
//  ✓✓  read      → double tick (BLUE)    — recipient ne padha

const Ticks = ({ status, readBy, deliveredTo, senderId, myId }) => {
    if (senderId !== myId) return null;

    if (status === 'sending')
        return <Ionicons name="time-outline"   size={14} color="#8696a0" style={{ marginLeft: 4 }} />;

    if (status === 'failed')
        return <Ionicons name="alert-circle"   size={14} color="red"     style={{ marginLeft: 4 }} />;

    // Read — blue double tick ✓✓
    if (status === 'read' || readBy?.length)
        return <Ionicons name="checkmark-done" size={14} color="#53bdeb" style={{ marginLeft: 4 }} />;

    // Delivered — grey double tick ✓✓
    if (status === 'delivered' || deliveredTo?.length)
        return <Ionicons name="checkmark-done" size={14} color="#8696a0" style={{ marginLeft: 4 }} />;

    // Sent — single grey tick ✓
    return <Ionicons name="checkmark"          size={14} color="#8696a0" style={{ marginLeft: 4 }} />;
};

export default Ticks;
