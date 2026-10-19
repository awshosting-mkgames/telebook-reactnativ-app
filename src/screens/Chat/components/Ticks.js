import React from 'react';
import { Ionicons } from '@expo/vector-icons';

// WhatsApp tick logic:
//  🕐  sending   → clock (grey)
//  ✓   sent      → single tick (grey)    — server ne receive kiya
//  ✓✓  delivered → double tick (grey)    — device ne receive kiya
//  ✓✓  read      → double tick (BLUE)    — recipient ne padha

const Ticks = ({ status, readBy, deliveredTo, senderId, myId, isDark = true }) => {
    if (senderId !== myId) return null;
    // Light-blue bubble (#d9efff) par default grey/cyan ticks dhundhle padte hain — light me gehre shade
    const GREY = isDark ? '#8696a0' : '#667781';
    const READ = isDark ? '#53bdeb' : '#0b84d6';

    if (status === 'sending')
        return <Ionicons name="time-outline"   size={14} color={GREY} style={{ marginLeft: 4 }} />;

    if (status === 'failed')
        return <Ionicons name="alert-circle"   size={14} color="red"     style={{ marginLeft: 4 }} />;

    // Read — blue double tick ✓✓
    if (status === 'read' || readBy?.length)
        return <Ionicons name="checkmark-done" size={14} color={READ} style={{ marginLeft: 4 }} />;

    // Delivered — grey double tick ✓✓
    if (status === 'delivered' || deliveredTo?.length)
        return <Ionicons name="checkmark-done" size={14} color={GREY} style={{ marginLeft: 4 }} />;

    // Sent — single grey tick ✓
    return <Ionicons name="checkmark"          size={14} color={GREY} style={{ marginLeft: 4 }} />;
};

export default Ticks;
