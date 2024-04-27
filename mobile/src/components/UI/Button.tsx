import { View, Text } from "react-native";
import React from "react";
import { Button as NButton } from "native-base";
import { useColors } from "../../context/ColorContex";

interface IProps {
  title: String;
  onPress: () => void;
  type?: "primary" | "disabled";
}

const Button: React.FC<IProps> = ({ title, onPress, type }) => {
  const { btnBgColor, textColor, main, gray } = useColors();

  return (
    <NButton
      bgColor={type == "primary" ? btnBgColor : gray.gray60}
      color={textColor}
      rounded={"full"}
      _pressed={{
        bgColor: type == "primary" ? main.jeansBlue : gray.gray80,
      }}
      onPress={onPress}
    >
      {title}
    </NButton>
  );
};

export default Button;
