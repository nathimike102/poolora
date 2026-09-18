import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useApp } from "../../context/AppContext";
import { safetyService, type IncidentData } from "../../services/safetyService";
import { initSocket, joinAdminSosRoom, getSocket } from "../../utils/socket";

export const AdminIncidentsScreen: React.FC = () => {
  const { c } = useApp();
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void loadIncidents();
    void joinAdminSosRoom().catch(() => {});

    initSocket();

    const socket = getSocket();
    const handleAlert = () => {
      void loadIncidents();
    };

    socket?.on("sos:alert", handleAlert);

    return () => {
      socket?.off("sos:alert", handleAlert);
    };
  }, []);

  const loadIncidents = async () => {
    try {
      const data = await safetyService.getActiveIncidents();
      setIncidents(data);
    } catch (error) {
      console.error("Failed to load incidents", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadIncidents();
    setRefreshing(false);
  };

  const onAcknowledge = async (id: string) => {
    try {
      await safetyService.acknowledgeIncident(id);
      await loadIncidents();
    } catch {
      Alert.alert("Error", "Failed to acknowledge incident");
    }
  };

  const onResolve = async (id: string) => {
    try {
      await safetyService.resolveIncident(id, "", false);
      await loadIncidents();
    } catch {
      Alert.alert("Error", "Failed to resolve incident");
    }
  };

  const onNotifyPolice = async (id: string) => {
    try {
      await safetyService.notifyPolice(id, "Notified by admin via dashboard");
      await loadIncidents();
      Alert.alert("Notified", "Police have been notified");
    } catch {
      Alert.alert("Error", "Failed to notify police");
    }
  };

  const renderItem = ({ item }: { item: IncidentData }) => (
    <View style={[styles.incidentCard, { backgroundColor: c.surface }]}> 
      <View style={styles.incidentHeader}>
        <Text style={[styles.userName, { color: c.text }]}>{item.userName}</Text>
        <Text
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                item.status === "triggered"
                  ? "#FF4444"
                  : item.status === "acknowledged"
                    ? "#FFA500"
                    : "#44AA44",
            },
          ]}
        >
          {item.status.toUpperCase()}
        </Text>
      </View>
      <Text style={{ color: c.text, fontSize: 12, marginTop: 8 }}>
        Location: {item.location.lat.toFixed(4)}, {item.location.lng.toFixed(4)}
      </Text>
      <Text style={{ color: c.text, fontSize: 12, marginTop: 4 }}>
        Raised at {new Date(item.timestamp).toLocaleTimeString()}
      </Text>
      <View style={styles.actionButtons}>
        {item.status === "triggered" && (
          <TouchableOpacity accessibilityRole="button" onPress={() => void onAcknowledge(item.id)}>
            <Text style={[styles.actionButton, { color: "#FFA500" }]}>Acknowledge</Text>
          </TouchableOpacity>
        )}
        {item.status !== "resolved" && (
          <TouchableOpacity accessibilityRole="button" onPress={() => void onResolve(item.id)}>
            <Text style={[styles.actionButton, { color: "#44AA44" }]}>Resolve</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity accessibilityRole="button" onPress={() => void onNotifyPolice(item.id)}>
          <Text style={[styles.actionButton, { color: "#EF5350" }]}>Police</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}> 
      <Text style={[styles.title, { color: c.text }]}>Safety incidents</Text>
      <Text style={[styles.subtitle, { color: c.textSec }]}>Total Active: {incidents.length}</Text>
      <FlatList
        data={incidents}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={{ color: c.text, textAlign: "center", marginTop: 20 }}>No active incidents</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  incidentCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#FF4444",
  },
  incidentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    color: "white",
    fontWeight: "bold",
  },
  actionButtons: {
    flexDirection: "row",
    marginTop: 12,
    gap: 12,
    flexWrap: "wrap",
  },
  actionButton: {
    fontSize: 12,
    fontWeight: "bold",
    padding: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
});
