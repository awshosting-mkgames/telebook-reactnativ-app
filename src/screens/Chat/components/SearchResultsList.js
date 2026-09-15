import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const SearchResultsList = ({
    results = [],
    isSearching,
    searchText,
    theme,
    fmtTime,
    onResultPress,
}) => {
    const isDark = theme?.background === "#000";

    if (isSearching) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#1296f3" />
            </View>
        );
    }

    if (!searchText.trim()) {
        return (
            <View style={styles.center}>
                <Text style={styles.hint}>Type to search messages</Text>
            </View>
        );
    }

    if (results.length === 0) {
        return (
            <View style={styles.center}>
                <Text style={styles.hint}>No results for "{searchText}"</Text>
            </View>
        );
    }

    return (
        <FlatList
            data={results}
            keyExtractor={(item, i) => item._id ?? i.toString()}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: 8 }}
            renderItem={({ item }) => (
                <TouchableOpacity
                    style={[
                        styles.row,
                        { borderBottomColor: isDark ? "#222" : "#f0f0f0" },
                    ]}
                    onPress={() => onResultPress?.(item)}
                    activeOpacity={0.7}
                >
                    <Text
                        style={[styles.name, { color: isDark ? "#fff" : "#111" }]}
                        numberOfLines={1}
                    >
                        {item.sender?.name ?? "User"}
                    </Text>
                    <Text
                        style={[styles.content, { color: isDark ? "#bbb" : "#555" }]}
                        numberOfLines={2}
                    >
                        {item.messageType !== "text"
                            ? `📎 ${item.messageType}`
                            : item.content}
                    </Text>
                    <Text style={styles.time}>{fmtTime(item.createdAt)}</Text>
                </TouchableOpacity>
            )}
        />
    );
};

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    hint: { color: "#999", fontSize: 14 },
    row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
    name: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
    content: { fontSize: 14, lineHeight: 19 },
    time: { fontSize: 11, color: "#888", marginTop: 4, alignSelf: "flex-end" },
});

export default SearchResultsList;