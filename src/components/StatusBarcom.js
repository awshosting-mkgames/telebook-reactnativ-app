import React from 'react';
import { StatusBar, View, Platform, StyleSheet } from 'react-native';


const StatusBarComponent = ({ backgroundColor = '#ffffff', barStyle = 'light-content'}) => {
    return (
        <StatusBar
            translucent
            backgroundColor={backgroundColor}
            barStyle={barStyle}
        />
    );
};


export default StatusBarComponent;
