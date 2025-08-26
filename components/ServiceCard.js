import { Card, CardActionArea, Box, Typography } from "@mui/material";

export default function ServiceCard({ title, icon, color='primary', active=false, onClick }){
  return (
    <Card
      elevation={active ? 16 : 4}
      sx={{
        borderRadius: 3,
        boxShadow: active ? '0 16px 40px rgba(0,0,0,0.4)' : undefined,
        transformStyle: 'preserve-3d',
        perspective: 1000,
        cursor: 'pointer',
        '&:hover .flip, &:focus-within .flip': { transform: 'rotateY(180deg)' }
      }}
    >
      <CardActionArea onClick={onClick} sx={{ p: 0 }}>
        <Box className="flip" sx={{ position:'relative', transition:'transform 500ms cubic-bezier(0.4, 0, 0.2, 1)', transformStyle:'preserve-3d', p: 3, minHeight: 140 }}>
          {/* Front */}
          <Box sx={{ 
            position:'absolute', 
            inset:0, 
            display:'grid', 
            placeItems:'center', 
            backfaceVisibility:'hidden', 
            borderRadius: 3, 
            bgcolor: active ? 'error.main' : (t)=>`${t.palette.primary.main}4D`, 
            color: active ? '#ffffff' : (t)=>t.palette.mode === 'dark' ? t.palette.primary.contrastText : t.palette.primary.main,
            '&:hover': (t) => ({
              background: t.palette.mode === 'dark' 
                ? `linear-gradient(135deg, ${t.palette.primary.main}33, ${t.palette.error.main}33)`
                : `linear-gradient(135deg, ${t.palette.primary.main}26, ${t.palette.primary.main}40)`
            })
          }}>
            {active ? (
              <Box sx={{ display:'flex', flexDirection:'column', gap:1, alignItems:'center' }}>
                <Box>{icon}</Box>
                <Typography variant="h6">{title}</Typography>
              </Box>
            ) : (
              <Box sx={{ 
                '& svg': { 
                  fontSize: 72, 
                  color: (t) => t.palette.mode === 'dark' ? '#ffffff' : t.palette.primary.main 
                } 
              }}>
                {icon}
              </Box>
            )}
          </Box>
          {/* Back */}
          <Box sx={{ 
            position:'absolute', 
            inset:0, 
            display:'grid', 
            placeItems:'center', 
            backfaceVisibility:'hidden', 
            transform: 'rotateY(180deg)', 
            borderRadius: 3, 
            bgcolor: (t)=>`${t.palette.primary.main}4D`, 
            color:'#fff', 
            px:2, 
            textAlign:'center',
            '&:hover': (t) => ({
              background: t.palette.mode === 'dark' 
                ? `linear-gradient(135deg, ${t.palette.primary.main}33, ${t.palette.error.main}33)`
                : `linear-gradient(135deg, ${t.palette.primary.main}26, ${t.palette.primary.main}40)`
            })
          }}>
            <Typography variant="subtitle1" sx={{ fontWeight:700 }}>{title}</Typography>
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  )
}
